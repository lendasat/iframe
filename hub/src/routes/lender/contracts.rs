use crate::approve_contract;
use crate::approve_contract::approve_contract;
use crate::bitmex_index_price_rest::get_bitmex_index_price;
use crate::contract_liquidation;
use crate::db;
use crate::db::contracts::update_extension_policy;
use crate::mark_as_principal_given::mark_as_principal_given;
use crate::mempool;
use crate::model;
use crate::model::compute_outstanding_balance;
use crate::model::compute_total_interest;
use crate::model::ConfirmInstallmentPaymentRequest;
use crate::model::ContractStatus;
use crate::model::ExtensionPolicy;
use crate::model::FiatLoanDetails;
use crate::model::InstallmentStatus;
use crate::model::Lender;
use crate::model::LiquidationStatus;
use crate::model::LoanAsset;
use crate::model::LoanTransaction;
use crate::model::ManualCollateralRecovery;
use crate::model::TransactionType;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use anyhow::anyhow;
use anyhow::Context;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::delete;
use axum::routing::get;
use axum::routing::post;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32::DerivationPath;
use bitcoin::consensus::encode::FromHexError;
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::Network;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use bitcoin::Txid;
use miniscript::Descriptor;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;
use url::Url;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/contracts",
            get(get_active_contracts).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id",
            get(get_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id/extension-policy",
            put(put_update_extension_policy).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/approve",
            put(put_approve_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/principalgiven",
            put(put_principal_given).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/reject",
            delete(delete_reject_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/reject-extension",
            put(put_reject_extension_request).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/confirm-installment",
            put(put_confirm_installment_payment).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id/liquidation-psbt",
            get(get_liquidation_to_bitcoin_psbt).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id/liquidation-to-stablecoin-psbt",
            post(post_build_liquidation_to_stablecoin_psbt).route_layer(
                middleware::from_fn_with_state(app_state.clone(), jwt_auth::auth),
            ),
        )
        .route(
            "/api/contracts/:id/broadcast-liquidation",
            post(post_liquidation_tx).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id/recovery-psbt",
            get(get_manual_recovery_psbt).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Contract {
    pub id: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_days: i32,
    pub initial_collateral_sats: u64,
    pub origination_fee_sats: u64,
    pub collateral_sats: u64,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub initial_ltv: Decimal,
    pub status: ContractStatus,
    pub lender_pk: PublicKey,
    pub lender_derivation_path: DerivationPath,
    pub borrower_pk: PublicKey,
    pub borrower_btc_address: String,
    pub borrower_loan_address: Option<String>,
    pub contract_address: Option<String>,
    pub collateral_script: Option<String>,
    pub loan_repayment_address: Option<String>,
    pub borrower: BorrowerProfile,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub expiry: OffsetDateTime,
    pub liquidation_status: LiquidationStatus,
    pub transactions: Vec<LoanTransaction>,
    pub loan_asset: LoanAsset,
    pub can_recover_collateral_manually: bool,
    #[serde(with = "rust_decimal::serde::float")]
    pub liquidation_price: Decimal,
    pub extends_contract: Option<String>,
    pub extended_by_contract: Option<String>,
    pub kyc_info: Option<KycInfo>,
    pub fiat_loan_details_borrower: Option<FiatLoanDetailsWrapper>,
    pub fiat_loan_details_lender: Option<FiatLoanDetailsWrapper>,
    pub borrower_npub: String,
    pub client_contract_id: Option<Uuid>,
    pub timeline: Vec<TimelineEvent>,
    pub extension_max_duration_days: u64,
    #[serde(with = "rust_decimal::serde::float_option")]
    pub extension_interest_rate: Option<Decimal>,
    pub installments: Vec<Installment>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FiatLoanDetailsWrapper {
    pub details: FiatLoanDetails,
    pub encrypted_encryption_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KycInfo {
    kyc_link: Url,
    is_kyc_done: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BorrowerProfile {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[instrument(skip_all, fields(lender_id = user.id), err(Debug))]
async fn get_active_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> Result<AppJson<Vec<Contract>>, Error> {
    let contracts = db::contracts::load_contracts_by_lender_id(&data.db, &user.id)
        .await
        .map_err(Error::database)?;

    let mut contracts_2 = Vec::new();
    for contract in contracts {
        let contract = map_to_api_contract(&data, contract).await?;

        contracts_2.push(contract);
    }

    Ok(AppJson(contracts_2))
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id), err(Debug))]
async fn get_contract(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(contract_id): Path<String>,
) -> Result<AppJson<Contract>, Error> {
    let contract =
        db::contracts::load_contract_by_contract_id_and_lender_id(&data.db, &contract_id, &user.id)
            .await
            .map_err(Error::database)?
            .ok_or_else(|| Error::MissingContract(contract_id.clone()))?;

    let contract = map_to_api_contract(&data, contract).await?;

    Ok(AppJson(contract))
}

#[derive(Debug, Deserialize)]
struct UpdateExtensionPolicyRequest {
    /// The maximum number of days a contract can be extended by.
    ///
    /// A zero value indicates that the contract cannot be extended.
    extension_max_duration_days: u64,
    /// The interest rate to be applied to the extension period.
    #[serde(with = "rust_decimal::serde::float")]
    extension_interest_rate: Decimal,
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id, body = ?body), ret, err(Debug))]
async fn put_update_extension_policy(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Lender>,
    body: AppJson<UpdateExtensionPolicyRequest>,
) -> Result<(), Error> {
    let extension_max_duration_days = body.0.extension_max_duration_days;
    let extension_policy = if extension_max_duration_days.is_zero() {
        ExtensionPolicy::DoNotExtend
    } else {
        ExtensionPolicy::AfterHalfway {
            max_duration_days: extension_max_duration_days,
            interest_rate: body.0.extension_interest_rate,
        }
    };

    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(Error::database)?
    .ok_or(Error::MissingContract(contract_id.clone()))?;

    update_extension_policy(&data.db, &contract_id, extension_policy)
        .await
        .map_err(Error::database)?;

    let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingBorrower)?;

    if !extension_max_duration_days.is_zero() {
        if let Err(err) = async {
            let loan_url = data
                .config
                .borrower_frontend_origin
                .join(format!("/my-contracts/{}", contract_id).as_str())?;

            data.notifications
                .send_contract_extension_enabled(borrower, loan_url)
                .await;
            anyhow::Ok(())
        }
        .await
        {
            tracing::error!("Failed notifying borrower {err:#}");
        }
    }

    Ok(())
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id, body = ?body), ret, err(Debug))]
async fn put_approve_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Lender>,
    body: Option<AppJson<model::FiatLoanDetailsWrapper>>,
) -> Result<(), Error> {
    let fiat_loan_details = body.map(|f| f.0);

    approve_contract(
        &data.db,
        &data.wallet,
        &data.mempool,
        &data.config,
        contract_id,
        &user.id,
        data.notifications.clone(),
        fiat_loan_details,
    )
    .await
    .map_err(Error::from)?;

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct PrincipalGivenQueryParam {
    pub txid: Option<String>,
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id, txid = query_params.txid ), err(Debug), ret)]
async fn put_principal_given(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    query_params: Query<PrincipalGivenQueryParam>,
    Extension(user): Extension<Lender>,
) -> Result<AppJson<Contract>, Error> {
    let contract = mark_as_principal_given(
        &data.db,
        &data.config,
        &data.notifications,
        &contract_id,
        &user.id,
        query_params.txid.clone(),
    )
    .await
    .map_err(Error::database)?;

    let contract = map_to_api_contract(&data, contract).await?;

    Ok(AppJson(contract))
}

/// Reject a contract request.
#[instrument(skip_all, fields(lender_id = user.id, contract_id), err(Debug), ret)]
async fn delete_reject_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Lender>,
) -> Result<(), Error> {
    let contract = db::contracts::reject_contract_request(&data.db, &user.id, &contract_id)
        .await
        .map_err(Error::database)?;

    // We don't want to fail this upwards because the contract request has already been approved.
    if let Err(err) = async {
        let loan_url = data
            .config
            .borrower_frontend_origin
            .join(&format!("/my-contracts/{contract_id}"))?;

        let borrower = db::borrowers::get_user_by_id(&data.db, &contract.borrower_id)
            .await?
            .context("Borrower not found")?;

        data.notifications
            .send_loan_request_rejected(borrower, loan_url)
            .await;

        db::contract_emails::mark_loan_request_rejected_as_sent(&data.db, &contract.id)
            .await
            .context("Failed to mark loan-request-rejected email as sent")?;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed notifying borrower {err:#}");
    }

    Ok(())
}

/// Reject a contract extension request.
#[instrument(skip_all, fields(lender_id = user.id, contract_id), err(Debug), ret)]
async fn put_reject_extension_request(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Lender>,
) -> Result<(), Error> {
    let contract =
        db::contracts::load_contract_by_contract_id_and_lender_id(&data.db, &contract_id, &user.id)
            .await
            .map_err(Error::database)?
            .ok_or_else(|| Error::MissingContract(contract_id.clone()))?;

    if contract.status != ContractStatus::RenewalRequested {
        return Err(Error::InvalidRejectRequest {
            status: contract.status,
        });
    }

    let mut db_tx = data
        .db
        .begin()
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let parent_contract_id =
        db::contract_extensions::get_parent_by_extended(&data.db, &contract_id)
            .await
            .map_err(|e| Error::database(anyhow!(e)))?
            .ok_or(Error::MissingParentContract(contract_id.clone()))?;

    db::contracts::cancel_extension(&mut *db_tx, &parent_contract_id)
        .await
        .map_err(Error::database)?;

    db::contract_extensions::delete_with_parent(&mut *db_tx, &parent_contract_id)
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    db::contracts::mark_contract_as_cancelled(&mut *db_tx, &contract_id)
        .await
        .map_err(Error::database)?;

    db_tx
        .commit()
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    Ok(())
}

#[instrument(skip_all, fields(lender_id = %user.id, contract_id = %contract_id, installment_id = %body.installment_id), err(Debug), ret)]
async fn put_confirm_installment_payment(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Lender>,
    AppJson(body): AppJson<ConfirmInstallmentPaymentRequest>,
) -> Result<(), Error> {
    let is_own_contract =
        db::contracts::check_if_contract_belongs_to_lender(&data.db, &contract_id, &user.id)
            .await
            .map_err(Error::database)?;

    if !is_own_contract {
        return Err(Error::MissingContract(contract_id.clone()));
    }

    db::installments::mark_as_confirmed(&data.db, body.installment_id, &contract_id)
        .await
        .map_err(Error::database)?;

    let installments = db::installments::get_all_for_contract_id(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    let is_repayment_confirmed = !installments.is_empty()
        && installments.iter().all(|i| {
            matches!(
                i.status,
                InstallmentStatus::Cancelled | InstallmentStatus::Confirmed
            )
        });

    if is_repayment_confirmed {
        db::contracts::mark_contract_as_repayment_confirmed(&data.db, &contract_id)
            .await
            .map_err(Error::database)?;
    }

    Ok(())
}

#[derive(Deserialize)]
pub enum LiquidationType {
    Bitcoin,
    StableCoin,
}

#[derive(Deserialize, Debug)]
pub struct LiquidationPsbtQueryParams {
    /// Fee rate in sats/vbyte.
    pub fee_rate: u64,
    /// Where to send the lender's share of the liquidation.
    pub address: Address<NetworkUnchecked>,
}

#[derive(Debug, Serialize)]
pub struct LiquidationPsbt {
    pub psbt: String,
    pub collateral_descriptor: Descriptor<PublicKey>,
    pub lender_pk: PublicKey,
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id, query_params), err(Debug), ret)]
async fn get_liquidation_to_bitcoin_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(contract_id): Path<String>,
    query_params: Query<LiquidationPsbtQueryParams>,
) -> Result<AppJson<LiquidationPsbt>, Error> {
    let expected_network = data.wallet.network();
    let lender_address = query_params
        .address
        .clone()
        .require_network(expected_network)
        .map_err(|_| Error::WrongAddressNetwork { expected_network })?;

    let contract =
        db::contracts::load_contract_by_contract_id_and_lender_id(&data.db, &contract_id, &user.id)
            .await
            .map_err(Error::database)?
            .ok_or_else(|| Error::MissingContract(contract_id.clone()))?;

    if !matches!(
        contract.status,
        ContractStatus::Defaulted | ContractStatus::Undercollateralized
    ) {
        return Err(Error::InvalidStateToLiquidate {
            current_state: contract.status,
        });
    }

    let installments = db::installments::get_all_for_contract_id(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    let contract_index = contract
        .contract_index
        .ok_or_else(|| Error::Database("Missing contract index".to_string()))?;

    let contract_address = contract
        .contract_address
        .clone()
        .ok_or_else(|| Error::Database("Missing contract address".to_string()))?;

    let collateral_outputs = data
        .mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        return Err(Error::Database("Missing collateral outputs".to_string()));
    }

    let price = get_bitmex_index_price(&data.config, OffsetDateTime::now_utc())
        .await
        .map_err(Error::bitmex_price)?;

    let outstanding_balance_usd = compute_outstanding_balance(&installments);
    let outstanding_balance_btc = outstanding_balance_usd
        .as_btc(price)
        .map_err(Error::outstanding_balance_calculation)?;

    let (collateral_descriptor, lender_pk, psbt) = contract_liquidation::prepare_liquidation_psbt(
        &data.wallet,
        contract,
        lender_address.as_unchecked().clone(),
        outstanding_balance_btc.total(),
        contract_index,
        data.mempool.clone(),
        query_params.fee_rate,
    )
    .await
    .map_err(Error::build_liquidation_psbt)?;

    let psbt = psbt.serialize_hex();

    Ok(AppJson(LiquidationPsbt {
        psbt,
        collateral_descriptor,
        lender_pk,
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiquidationToStablecoinPsbtRequest {
    bitcoin_refund_address: Address<NetworkUnchecked>,
    fee_rate_sats_vbyte: u64,
}

#[derive(Debug, Serialize)]
pub struct LiquidationToStableCoinPsbt {
    pub psbt: String,
    pub collateral_descriptor: Descriptor<PublicKey>,
    pub lender_pk: PublicKey,
    pub settle_address: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub settle_amount: Decimal,
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id, connection_details, body), err(Debug), ret)]
async fn post_build_liquidation_to_stablecoin_psbt(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Lender>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<LiquidationToStablecoinPsbtRequest>,
) -> Result<AppJson<LiquidationToStableCoinPsbt>, Error> {
    let lender_ip = match connection_details.ip {
        None => {
            return Err(Error::RequestIpRequired);
        }
        Some(ip) => ip.to_string(),
    };

    let contract =
        db::contracts::load_contract_by_contract_id_and_lender_id(&data.db, &contract_id, &user.id)
            .await
            .map_err(Error::database)?
            .ok_or_else(|| Error::MissingContract(contract_id.clone()))?;

    if !matches!(
        contract.status,
        ContractStatus::Defaulted | ContractStatus::Undercollateralized
    ) {
        return Err(Error::InvalidStateToLiquidate {
            current_state: contract.status,
        });
    }

    let installments = db::installments::get_all_for_contract_id(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    tracing::info!("Contract will be liquidated to stablecoins");

    let loan_deal = db::loan_deals::get_loan_deal_by_id(&data.db, &contract.loan_id)
        .await
        .map_err(Error::database)?;

    let outstanding_balance_usd = compute_outstanding_balance(&installments);

    let loan_repayment_address = contract
        .lender_loan_repayment_address
        .clone()
        .ok_or_else(|| Error::Database("Missing lender loan repayment address".to_string()))?;

    let expected_network = data.wallet.network();
    let bitcoin_refund_address = body
        .bitcoin_refund_address
        .clone()
        .require_network(expected_network)
        .map_err(|_| Error::WrongAddressNetwork { expected_network })?;

    let (shift_address, lender_amount, settle_address, settle_amount) = data
        .sideshift
        .create_shift(
            loan_deal.loan_asset(),
            outstanding_balance_usd.total(),
            contract_id.to_string(),
            lender_ip.to_string(),
            bitcoin_refund_address.to_string(),
            loan_repayment_address.clone(),
        )
        .await
        .map_err(Error::sideshift)?;

    let contract_index = &contract
        .contract_index
        .ok_or_else(|| Error::Database("Missing contract index".to_string()))?;

    let (collateral_descriptor, lender_pk, psbt) = contract_liquidation::prepare_liquidation_psbt(
        &data.wallet,
        contract,
        shift_address,
        lender_amount,
        *contract_index,
        data.mempool.clone(),
        body.fee_rate_sats_vbyte,
    )
    .await
    .map_err(Error::build_liquidation_psbt)?;

    let psbt = psbt.serialize_hex();

    Ok(AppJson(LiquidationToStableCoinPsbt {
        psbt,
        collateral_descriptor,
        lender_pk,
        settle_address,
        settle_amount,
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiquidationTx {
    pub tx: String,
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id, body), err(Debug), ret)]
async fn post_liquidation_tx(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<LiquidationTx>,
) -> Result<AppJson<Txid>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(Error::database)?
    .ok_or_else(|| Error::MissingContract(contract_id.clone()))?;

    let signed_claim_tx_str = body.tx;
    let signed_claim_tx: Transaction =
        bitcoin::consensus::encode::deserialize_hex(&signed_claim_tx_str)
            .map_err(Error::invalid_psbt)?;
    let claim_txid = signed_claim_tx.compute_txid();

    let claim_type = if ContractStatus::Defaulted == contract.status {
        mempool::ClaimTxType::Defaulted
    } else {
        mempool::ClaimTxType::Liquidated
    };

    data.mempool
        .send(mempool::TrackCollateralClaim {
            contract_id: contract_id.clone(),
            claim_txid,
            claim_type,
        })
        .await
        .expect("actor to be alive")
        .map_err(Error::track_transaction)?;

    data.mempool
        .send(mempool::PostTx(signed_claim_tx_str))
        .await
        .expect("actor to be alive")
        .map_err(Error::post_transaction)?;

    // TODO: Use a database transaction.
    db::transactions::insert_liquidation_txid(&data.db, &contract_id, &claim_txid)
        .await
        .map_err(Error::database)?;

    db::contracts::mark_contract_as_closing(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    if let Err(e) = async {
        let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
            &data.db,
            &contract_id,
            &user.id,
        )
        .await
        .context("Failed to load contract")?
        .context("Contract not found")?;

        let borrower = db::borrowers::get_user_by_id(&data.db, &contract.borrower_id)
            .await?
            .context("Borrower not found")?;

        let loan_url = data
            .config
            .borrower_frontend_origin
            .join(&format!("/my-contracts/{}", contract_id))?;

        let emails = db::contract_emails::load_contract_emails(&data.db, &contract.id).await?;
        if emails.defaulted_loan_liquidated_sent {
            // Email already sent
            return Ok(claim_txid.to_string());
        }

        data.notifications
            .send_loan_liquidated_after_default(borrower, loan_url)
            .await;

        db::contract_emails::mark_defaulted_loan_liquidated_as_sent(&data.db, &contract.id)
            .await
            .context("Failed to mark defaulted-loan-liquidated email as sent")?;

        // Not actually used, but required. I think the compiler is tripping here.
        anyhow::Ok("".to_string())
    }
    .await
    {
        tracing::error!(
            "Failed at notifying borrower about loan liquidation due to default: {e:#}"
        );
    }

    Ok(AppJson(claim_txid))
}

#[derive(Debug, Serialize)]
pub struct ManualRecoveryPsbt {
    pub psbt: String,
    pub collateral_descriptor: Descriptor<PublicKey>,
    pub lender_pk: PublicKey,
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id, query_params), err(Debug), ret)]
async fn get_manual_recovery_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(contract_id): Path<String>,
    query_params: Query<LiquidationPsbtQueryParams>,
) -> Result<AppJson<ManualRecoveryPsbt>, Error> {
    let expected_network = data.wallet.network();
    let lender_address = query_params
        .address
        .clone()
        .require_network(expected_network)
        .map_err(|_| Error::WrongAddressNetwork { expected_network })?;

    let contract =
        db::contracts::load_contract_by_contract_id_and_lender_id(&data.db, &contract_id, &user.id)
            .await
            .map_err(Error::database)?
            .ok_or_else(|| Error::MissingContract(contract_id.clone()))?;

    let ManualCollateralRecovery { lender_amount, .. } =
        db::manual_collateral_recovery::load_manual_collateral_recovery(&data.db, &contract.id)
            .await
            .map_err(Error::database)?
            .ok_or_else(|| Error::InvalidStateForManualRecovery)?;

    let contract_index = contract
        .contract_index
        .ok_or_else(|| Error::Database("Missing contract index".to_string()))?;

    let contract_address = contract
        .contract_address
        .ok_or_else(|| Error::Database("Missing contract address".to_string()))?;

    let collateral_outputs = data
        .mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        return Err(Error::Database("Missing collateral outputs".to_string()));
    }

    let origination_fee = Amount::from_sat(contract.origination_fee_sats);

    let (psbt, collateral_descriptor, lender_pk) = data
        .wallet
        .create_liquidation_psbt(
            contract.borrower_pk,
            contract.lender_pk,
            contract_index,
            collateral_outputs,
            origination_fee,
            lender_amount,
            lender_address,
            contract.borrower_btc_address.assume_checked(),
            query_params.fee_rate,
            contract.contract_version,
        )
        .map_err(Error::build_liquidation_psbt)?;

    let psbt = psbt.serialize_hex();

    Ok(AppJson(ManualRecoveryPsbt {
        psbt,
        collateral_descriptor,
        lender_pk,
    }))
}

/// Convert from a [`model::Contract`] to a [`crate::routes::borrower::Contract`].
async fn map_to_api_contract(
    data: &Arc<AppState>,
    contract: model::Contract,
) -> Result<Contract, Error> {
    let loan_deal = db::loan_deals::get_loan_deal_by_id(&data.db, &contract.loan_id)
        .await
        .map_err(Error::database)?;

    let borrower = db::borrowers::get_user_by_id(&data.db, &contract.borrower_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    let transactions = db::transactions::get_all_for_contract_id(&data.db, &contract.id)
        .await
        .map_err(Error::database)?;

    let can_recover_collateral_manually =
        db::manual_collateral_recovery::load_manual_collateral_recovery(&data.db, &contract.id)
            .await
            .map_err(Error::database)?
            .is_some();

    let parent_contract_id =
        db::contract_extensions::get_parent_by_extended(&data.db, &contract.id)
            .await
            .map_err(|e| Error::database(anyhow!(e)))?;
    let child_contract = db::contract_extensions::get_extended_by_parent(&data.db, &contract.id)
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let kyc_info = match loan_deal.kyc_link() {
        Some(ref kyc_link) => {
            let is_kyc_done = db::kyc::get(&data.db, &contract.lender_id, &borrower.id)
                .await
                .map_err(Error::database)?;

            Some(KycInfo {
                kyc_link: kyc_link.clone(),
                is_kyc_done: is_kyc_done.unwrap_or(false),
            })
        }
        None => None,
    };

    let new_offer = loan_deal;

    let fiat_loan_details_borrower = {
        let details = db::fiat_loan_details::get_borrower(&data.db, &contract.id)
            .await
            .map_err(Error::database)?;

        details.map(|d| FiatLoanDetailsWrapper {
            details: d.details,
            encrypted_encryption_key: d.encrypted_encryption_key_lender,
        })
    };

    let fiat_loan_details_lender = {
        let details = db::fiat_loan_details::get_lender(&data.db, &contract.id)
            .await
            .map_err(Error::database)?;

        details.map(|d| FiatLoanDetailsWrapper {
            details: d.details,
            encrypted_encryption_key: d.encrypted_encryption_key_borrower,
        })
    };

    let collateral_script = match contract.contract_index {
        Some(contract_index) => {
            let collateral_descriptor = data
                .wallet
                .collateral_descriptor(
                    contract.borrower_pk,
                    contract.lender_pk,
                    contract.contract_version,
                    contract_index,
                )
                .map_err(Error::cannot_build_descriptor)?;
            let collateral_script = collateral_descriptor.script_code().expect("not taproot");
            let collateral_script = collateral_script.to_hex_string();

            Some(collateral_script)
        }
        None => None,
    };

    let installments = db::installments::get_all_for_contract_id(&data.db, &contract.id)
        .await
        .map_err(Error::database)?;

    let liquidation_price = contract.liquidation_price(&installments);

    let timeline = map_timeline(&data.db, &contract, &transactions, &installments).await?;

    let (extension_max_duration_days, extension_interest_rate) = match contract.extension_policy {
        ExtensionPolicy::DoNotExtend => (0, None),
        ExtensionPolicy::AfterHalfway {
            max_duration_days,
            interest_rate,
        } => (max_duration_days, Some(interest_rate)),
    };

    let total_interest = compute_total_interest(&installments);

    let contract = Contract {
        id: contract.id,
        loan_amount: contract.loan_amount,
        duration_days: contract.duration_days,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        collateral_sats: contract.collateral_sats,
        interest_rate: contract.interest_rate,
        interest: total_interest,
        initial_ltv: contract.initial_ltv,
        status: contract.status,
        lender_pk: contract.lender_pk,
        lender_derivation_path: contract.lender_derivation_path,
        borrower_pk: contract.borrower_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        collateral_script,
        loan_repayment_address: contract.lender_loan_repayment_address,
        borrower: BorrowerProfile {
            id: borrower.id,
            name: borrower.name,
        },
        created_at: contract.created_at,
        updated_at: contract.updated_at,
        expiry: contract.expiry_date,
        liquidation_status: contract.liquidation_status,
        transactions,
        loan_asset: new_offer.loan_asset(),
        can_recover_collateral_manually,
        liquidation_price,
        extends_contract: parent_contract_id,
        extended_by_contract: child_contract,
        kyc_info,
        fiat_loan_details_borrower,
        fiat_loan_details_lender,
        borrower_npub: contract.borrower_npub,
        client_contract_id: contract.client_contract_id,
        timeline,
        extension_max_duration_days,
        extension_interest_rate,
        installments: installments.into_iter().map(Installment::from).collect(),
    };

    Ok(contract)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Installment {
    pub id: Uuid,
    pub principal: Decimal,
    pub interest: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub due_date: OffsetDateTime,
    pub status: InstallmentStatus,
    #[serde(with = "time::serde::rfc3339::option")]
    pub paid_date: Option<OffsetDateTime>,
    pub payment_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineEvent {
    #[serde(with = "time::serde::rfc3339")]
    date: OffsetDateTime,
    event: TimelineEventKind,
    /// Only provided if it was an event caused by a transaction.
    txid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum TimelineEventKind {
    ContractStatusChange { status: ContractStatus },
    Installment { is_confirmed: bool },
}

async fn map_timeline(
    db: &Pool<Postgres>,
    contract: &model::Contract,
    transactions: &[LoanTransaction],
    installments: &[model::Installment],
) -> Result<Vec<TimelineEvent>, Error> {
    let event_logs = db::contract_status_log::get_contract_status_logs(db, &contract.id)
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    // First, we add the contract request event.
    let mut timeline = vec![TimelineEvent {
        date: contract.created_at,
        event: TimelineEventKind::ContractStatusChange {
            status: ContractStatus::Requested,
        },
        txid: None,
    }];

    // Then we go through funding transactions. There might be multiple, that's why we need to
    // handle them separately.
    transactions.iter().for_each(|tx| {
        if TransactionType::Funding == tx.transaction_type {
            let event = TimelineEvent {
                date: tx.timestamp,
                // We assume each transaction has already been confirmed.
                event: TimelineEventKind::ContractStatusChange {
                    status: ContractStatus::CollateralConfirmed,
                },
                txid: Some(tx.txid.clone()),
            };
            timeline.push(event);
        }
    });

    // Next we generate events based on paid and confirmed installments.
    installments.iter().for_each(|i| {
        if let Some(paid_date) = i.paid_date {
            let event = TimelineEvent {
                date: paid_date,
                event: TimelineEventKind::Installment {
                    is_confirmed: matches!(i.status, InstallmentStatus::Confirmed),
                },
                txid: i.payment_id.clone(),
            };
            timeline.push(event);
        }
    });

    // Finally, we go through the contract events and enhance them with transaction IDs, if
    // applicable.
    let rest_of_timeline = event_logs
        .into_iter()
        .filter_map(|log| {
            let txid = match log.new_status {
                ContractStatus::CollateralSeen => transactions.iter().find_map(|tx| {
                    (tx.transaction_type == TransactionType::Funding).then(|| tx.txid.clone())
                }),
                ContractStatus::PrincipalGiven => transactions.iter().find_map(|tx| {
                    (tx.transaction_type == TransactionType::PrincipalGiven)
                        .then(|| tx.txid.clone())
                }),
                ContractStatus::Closing
                | ContractStatus::Closed
                | ContractStatus::Defaulted
                | ContractStatus::ClosedByLiquidation
                | ContractStatus::ClosedByDefaulting => transactions.iter().find_map(|tx| {
                    (tx.transaction_type == TransactionType::ClaimCollateral)
                        .then(|| tx.txid.clone())
                }),
                ContractStatus::Requested
                | ContractStatus::RenewalRequested
                | ContractStatus::Approved
                | ContractStatus::RepaymentProvided
                | ContractStatus::RepaymentConfirmed
                | ContractStatus::Undercollateralized
                | ContractStatus::Extended
                | ContractStatus::Rejected
                | ContractStatus::DisputeBorrowerStarted
                | ContractStatus::DisputeLenderStarted
                | ContractStatus::DisputeBorrowerResolved
                | ContractStatus::DisputeLenderResolved
                | ContractStatus::Cancelled
                | ContractStatus::RequestExpired
                | ContractStatus::ApprovalExpired => {
                    // There are no transactions associated with these events.
                    None
                }
                ContractStatus::CollateralConfirmed => {
                    // We handled this event already. Note: returning `None` means we filter out
                    // this event.
                    return None;
                }
            };

            Some(TimelineEvent {
                date: log.changed_at,
                event: TimelineEventKind::ContractStatusChange {
                    status: log.new_status,
                },
                txid,
            })
        })
        .collect::<Vec<_>>();

    timeline.extend(rest_of_timeline);

    timeline.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(timeline)
}

// Error fields are allowed to be dead code because they are actually used when printed in logs.
#[allow(dead_code)]
/// All the errors related to the `contracts` REST API.
#[derive(Debug)]
enum Error {
    /// Missing contract.
    MissingContract(String),
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(String),
    /// Referenced loan does not exist.
    MissingLoanOffer { offer_id: String },
    /// Referenced lender does not exist.
    MissingLender,
    /// Loan extension was requested with an offer from a different lender which is currently not
    /// supported
    LoanOfferLenderMissmatch,
    /// We failed at calculating the interest rate. Cannot do much without this
    InterestRateCalculation(String),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(String),
    /// Fiat loan details were not provided
    MissingFiatLoanDetails,
    /// Failed to generate contract address.
    ContractAddress(String),
    /// Failed to track accepted contract using Mempool API.
    TrackContract(String),
    /// Failed to track transaction using Mempool API.
    TrackTransaction(String),
    /// Failed to track transaction using Mempool API.
    PostTransaction(String),
    /// The contract was in an invalid state to approve a request or an extension.
    InvalidApproveRequest { status: ContractStatus },
    /// The contract was in an invalid state to reject a request or an extension.
    InvalidRejectRequest { status: ContractStatus },
    /// Referenced borrower does not exist.
    MissingBorrower,
    /// Failed to build contract descriptor.
    CannotBuildDescriptor(String),
    /// Can't cancel a contract extension request if the parent does not exist.
    MissingParentContract(String),
    /// Cannot approve renewal without contract address.
    MissingContractAddress,
    /// Invalid PSBT,
    InvalidPsbt(String),
    /// Wrong network for Bitcoin address.
    WrongAddressNetwork { expected_network: Network },
    /// Cannot liquidate in the contract's current state.
    InvalidStateToLiquidate { current_state: ContractStatus },
    /// Cannot manually recover collateral in the contract's current state.
    InvalidStateForManualRecovery,
    /// Failed to get price from BitMEX.
    BitMexPrice(String),
    /// Failed to calculate outstanding balance.
    OutstandingBalanceCalculation(String),
    /// Failed to build liquidation PSBT,
    BuildLiquidationPsbt(String),
    /// We need the request IP to check if this request is permitted.
    RequestIpRequired,
    /// SideShift error.
    SideShift(String),
}

impl Error {
    fn database(e: anyhow::Error) -> Self {
        Self::Database(format!("{e:#}"))
    }

    fn contract_address(e: anyhow::Error) -> Self {
        Self::ContractAddress(format!("{e:#}"))
    }

    fn track_contract(e: anyhow::Error) -> Self {
        Self::TrackContract(format!("{e:#}"))
    }

    fn track_transaction(e: anyhow::Error) -> Self {
        Self::TrackTransaction(format!("{e:#}"))
    }

    fn post_transaction(e: anyhow::Error) -> Self {
        Self::PostTransaction(format!("{e:#}"))
    }

    fn cannot_build_descriptor(e: anyhow::Error) -> Self {
        Self::CannotBuildDescriptor(format!("{e:#}"))
    }

    fn invalid_psbt(e: FromHexError) -> Self {
        Self::InvalidPsbt(format!("{:#}", anyhow!(e)))
    }

    fn bitmex_price(e: anyhow::Error) -> Self {
        Self::BitMexPrice(format!("{e:#}"))
    }

    fn outstanding_balance_calculation(e: anyhow::Error) -> Self {
        Self::OutstandingBalanceCalculation(format!("{e:#}"))
    }

    fn build_liquidation_psbt(e: anyhow::Error) -> Self {
        Self::BuildLiquidationPsbt(format!("{e:#}"))
    }

    fn sideshift(e: anyhow::Error) -> Self {
        Self::SideShift(format!("{e:#}"))
    }
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

/// Tell `axum` how [`AppError`] should be converted into a response.
///
/// This is also a convenient place to log errors.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::JsonRejection(rejection) => {
                // This error is caused by bad user input so don't log it
                (rejection.status(), rejection.body_text())
            }
            Error::Database(_)
            | Error::MissingLoanOffer { .. }
            | Error::MissingLender
            | Error::MissingOriginationFee
            | Error::OriginationFeeCalculation(_)
            | Error::InterestRateCalculation(_)
            | Error::ContractAddress(_)
            | Error::TrackContract(_)
            | Error::MissingBorrower
            | Error::CannotBuildDescriptor(_)
            | Error::MissingParentContract(_)
            | Error::MissingContractAddress
            | Error::TrackTransaction(_)
            | Error::PostTransaction(_)
            | Error::BitMexPrice(_)
            | Error::OutstandingBalanceCalculation(_)
            | Error::BuildLiquidationPsbt(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::LoanOfferLenderMissmatch => (
                StatusCode::BAD_REQUEST,
                "Offer cannot be from a different lender".to_owned(),
            ),
            Error::MissingFiatLoanDetails => (
                StatusCode::BAD_REQUEST,
                "Cannot approve without fiat loan details".to_owned(),
            ),
            Error::InvalidApproveRequest { .. } => {
                (StatusCode::BAD_REQUEST, "Cannot approve request".to_owned())
            }
            Error::InvalidRejectRequest { .. } => {
                (StatusCode::BAD_REQUEST, "Cannot reject request".to_owned())
            }
            Error::MissingContract(contract_id) => (
                StatusCode::BAD_REQUEST,
                format!("Contract does not exist: {contract_id}"),
            ),
            Error::InvalidPsbt(_) => (
                StatusCode::BAD_REQUEST,
                "The PSBT provided cannot be parsed".to_owned(),
            ),
            Error::WrongAddressNetwork { expected_network } => (
                StatusCode::BAD_REQUEST,
                format!("Wrong network for Bitcoin address. Expected: {expected_network}"),
            ),
            Error::InvalidStateToLiquidate { current_state } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot liquidate in state {current_state:?}"),
            ),
            Error::InvalidStateForManualRecovery => (
                StatusCode::BAD_REQUEST,
                "Cannot recover collateral manually in current state".to_string(),
            ),
            Error::RequestIpRequired => (
                StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
                "Request IP required".to_string(),
            ),
            Error::SideShift(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Service unavailable".to_string(),
            ),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

// Create our own JSON extractor by wrapping `axum::Json`. This makes it easy to override the
// rejection and provide our own which formats errors to match our application.
//
// `axum::Json` responds with plain text if the input is invalid.
#[derive(Debug, FromRequest)]
#[from_request(via(Json), rejection(Error))]
struct AppJson<T>(T);

impl<T> IntoResponse for AppJson<T>
where
    Json<T>: IntoResponse,
{
    fn into_response(self) -> Response {
        Json(self.0).into_response()
    }
}

impl From<approve_contract::Error> for Error {
    fn from(value: approve_contract::Error) -> Self {
        match value {
            approve_contract::Error::Database(e) => Error::database(e),
            approve_contract::Error::MissingLoanOffer { offer_id } => {
                Error::MissingLoanOffer { offer_id }
            }
            approve_contract::Error::MissingFiatLoanDetails => Error::MissingFiatLoanDetails,
            approve_contract::Error::ContractAddress(error) => Error::contract_address(error),
            approve_contract::Error::MissingBorrower => Error::MissingBorrower,
            approve_contract::Error::TrackContract(error) => Error::track_contract(error),
            approve_contract::Error::InvalidApproveRequest { status } => {
                Error::InvalidApproveRequest { status }
            }
            approve_contract::Error::MissingContractAddress => Error::MissingContractAddress,
            approve_contract::Error::MissingContract(contract_id) => {
                Error::MissingContract(contract_id)
            }
        }
    }
}

impl From<model::Installment> for Installment {
    fn from(value: model::Installment) -> Self {
        Self {
            id: value.id,
            principal: value.principal,
            interest: value.interest,
            due_date: value.due_date,
            status: value.status,
            paid_date: value.paid_date,
            payment_id: value.payment_id,
        }
    }
}
