use crate::approve_contract::approve_contract;
use crate::bitmex_index_price_rest::get_bitmex_index_price;
use crate::contract_liquidation;
use crate::db;
use crate::email::Email;
use crate::mempool;
use crate::model;
use crate::model::ContractStatus;
use crate::model::LiquidationStatus;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanTransaction;
use crate::model::ManualCollateralRecovery;
use crate::model::TransactionType;
use crate::model::User;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
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
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use miniscript::Descriptor;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;

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
            "/api/contracts/:contract_id/principalconfirmed",
            put(put_confirm_repayment).route_layer(middleware::from_fn_with_state(
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
    pub duration_months: i32,
    pub initial_collateral_sats: u64,
    pub origination_fee_sats: u64,
    pub collateral_sats: u64,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub initial_ltv: Decimal,
    pub status: ContractStatus,
    pub borrower_pk: PublicKey,
    pub borrower_btc_address: String,
    pub borrower_loan_address: String,
    pub contract_address: Option<String>,
    pub loan_repayment_address: String,
    pub borrower: BorrowerProfile,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339::option")]
    pub repaid_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub expiry: OffsetDateTime,
    pub liquidation_status: LiquidationStatus,
    pub transactions: Vec<LoanTransaction>,
    pub loan_asset_chain: LoanAssetChain,
    pub loan_asset_type: LoanAssetType,
    pub can_recover_collateral_manually: bool,
    pub extends_contract: Option<String>,
    pub extended_by_contract: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BorrowerProfile {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[instrument(skip_all, err(Debug))]
pub async fn get_active_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<AppJson<Vec<Contract>>, Error> {
    let contracts = db::contracts::load_contracts_by_lender_id(&data.db, user.id.as_str())
        .await
        .map_err(Error::Database)?;

    let mut contracts_2 = Vec::new();
    for contract in contracts {
        let contract = map_to_api_contract(&data, contract).await?;

        contracts_2.push(contract);
    }

    Ok(AppJson(contracts_2))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_contract(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
) -> Result<AppJson<Contract>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    let contract = map_to_api_contract(&data, contract).await?;

    Ok(AppJson(contract))
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_approve_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let wallet = data.wallet.lock().await;
    approve_contract(
        &data.db,
        wallet,
        &data.mempool,
        &data.config,
        contract_id,
        &user.id,
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {e:?}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct PrincipalGivenQueryParam {
    pub txid: String,
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_principal_given(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    query_params: Query<PrincipalGivenQueryParam>,
    Extension(user): Extension<User>,
) -> Result<AppJson<Contract>, Error> {
    let contract = async {
        let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
            &data.db,
            contract_id.as_str(),
            &user.id,
        )
        .await
        .context("Failed to load contract request")?;

        db::contracts::mark_contract_as_principal_given(
            &data.db,
            contract_id.as_str(),
            contract.duration_months,
        )
        .await
        .context("Failed to mark contract as repaid")?;

        db::transactions::insert_principal_given_txid(
            &data.db,
            contract_id.as_str(),
            query_params.txid.as_str(),
        )
        .await
        .context("Failed inserting principal given tx id")?;

        anyhow::Ok(contract)
    }
    .await
    .map_err(Error::Database)?;

    // We don't want to fail this upwards because the contract request has been already
    // approved.
    if let Err(e) = async {
        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.borrower_frontend_origin.to_owned(),
            contract_id
        );
        let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
            .await?
            .context("Borrower not found")?;

        let email = Email::new(data.config.clone());

        email
            .send_loan_paid_out(borrower, loan_url.as_str())
            .await
            .context("Failed to send loan-paid-out email")?;

        db::contract_emails::mark_loan_paid_out_as_sent(&data.db, &contract.id)
            .await
            .context("Failed to mark loan-paid-out email as sent")?;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying borrower about loan payout: {e:#}");
    }

    let contract = map_to_api_contract(&data, contract).await?;

    Ok(AppJson(contract))
}

#[instrument(skip_all, err(Debug))]
pub async fn delete_reject_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract =
        db::contracts::reject_contract_request(&data.db, user.id.as_str(), contract_id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    // We don't want to fail this upwards because the contract request has been already
    // approved.
    if let Err(err) = async {
        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.borrower_frontend_origin.to_owned(),
            contract_id
        );

        let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
            .await?
            .context("Borrower not found")?;

        let email = Email::new(data.config.clone());
        email
            .send_loan_request_rejected(borrower, loan_url.as_str())
            .await
            .context("Failed to send loan-request-approved email")?;

        db::contract_emails::mark_loan_request_rejected_as_sent(&data.db, &contract.id)
            .await
            .context("Failed to mark loan-request-approved email as sent")?;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed notifying borrower {err:#}");
    }

    Ok(())
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_confirm_repayment(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    async {
        let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
            &data.db,
            contract_id.as_str(),
            &user.id,
        )
        .await
        .context("Failed to load contract request")?;

        db::contracts::mark_contract_as_repayment_confirmed(&data.db, contract.id.as_str())
            .await
            .context("Failed to confirm contract as repaid")?;

        anyhow::Ok(())
    }
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {e:#}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    Ok(())
}

#[derive(Deserialize)]
pub enum LiquidationType {
    Bitcoin,
    StableCoin,
}

#[derive(Deserialize)]
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

#[instrument(skip_all, fields(lender_id = user.id, contract_id), err(Debug), ret)]
async fn get_liquidation_to_bitcoin_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
    query_params: Query<LiquidationPsbtQueryParams>,
) -> Result<Json<LiquidationPsbt>, (StatusCode, Json<ErrorResponse>)> {
    let mut wallet = data.wallet.lock().await;

    let lender_address = query_params
        .address
        .clone()
        .require_network(wallet.network())
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Invalid address: {e:#}"),
            };
            (StatusCode::BAD_REQUEST, Json(error_response))
        })?;

    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {e:#}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    if !matches!(
        contract.status,
        ContractStatus::Defaulted | ContractStatus::Undercollateralized
    ) {
        let error_response = ErrorResponse {
            message: format!("Cannot liquidate contract in state: {:?}", contract.status),
        };

        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let offer = db::loan_offers::loan_by_id(&data.db, &contract.loan_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .context("No loan found for contract")
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Illegal state error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let contract_index = contract.contract_index.ok_or_else(|| {
        let error_response = ErrorResponse {
            message: "Database error: missing contract index".to_string(),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let contract_address = contract.contract_address.clone().ok_or_else(|| {
        let error_response = ErrorResponse {
            message: "Database error: missing contract address".to_string(),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let collateral_outputs = data
        .mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        let error_response = ErrorResponse {
            message: "Database error: missing collateral outputs".to_string(),
        };

        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
    }

    let price = get_bitmex_index_price(OffsetDateTime::now_utc())
        .await
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Database error: {e:#}"),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let lender_amount = calculate_lender_liquidation_amount(
        contract.loan_amount,
        offer.interest_rate,
        contract.duration_months as u32,
        price,
    )
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Failed to calculate lender amount: {e:#}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let (collateral_descriptor, lender_pk, psbt) = contract_liquidation::prepare_liquidation_psbt(
        &mut wallet,
        contract,
        lender_address.as_unchecked().clone(),
        lender_amount,
        contract_index,
        data.mempool.clone(),
        query_params.fee_rate,
    )
    .await
    .map_err(|err| {
        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{err:#}").as_str(),
        )
    })?;

    let psbt = psbt.serialize_hex();

    let res = LiquidationPsbt {
        psbt,
        collateral_descriptor,
        lender_pk,
    };

    Ok(Json(res))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiquidationToStablecoinPsbtQueryParams {
    // TODO: can we use bitcoin::Address here?
    bitcoin_refund_address: String,
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

#[instrument(skip_all, fields(lender_id = user.id, contract_id), err(Debug), ret)]
async fn post_build_liquidation_to_stablecoin_psbt(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    Json(body): Json<LiquidationToStablecoinPsbtQueryParams>,
) -> Result<Json<LiquidationToStableCoinPsbt>, (StatusCode, Json<ErrorResponse>)> {
    let lender_ip = match connection_details.ip {
        None => {
            return Err(error_response(
                StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
                "Request IP required",
            ));
        }
        Some(ip) => ip.to_string(),
    };

    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(|e| {
        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {e:#}").as_str(),
        )
    })?;

    if !matches!(
        contract.status,
        ContractStatus::Defaulted | ContractStatus::Undercollateralized
    ) {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            format!("Cannot liquidate contract in state: {:?}", contract.status).as_str(),
        ));
    }

    tracing::info!("Contract will be liquidated to stable coins");
    let offer = db::loan_offers::loan_by_id(&data.db, contract.loan_id.as_str())
        .await
        .map_err(|err| {
            tracing::error!(
                contract_id,
                loan_id = contract.loan_id,
                "Failed loading offer for contract {err:#}"
            );
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        })?
        .ok_or_else(|| {
            tracing::error!(contract_id, "Failed loading offer for contract");
            error_response(StatusCode::BAD_REQUEST, "Invalid contract id")
        })?;

    let lender_amount = contract.loan_amount
        + calculate_interest(
            contract.loan_amount,
            offer.interest_rate,
            contract.duration_months as u32,
        );

    let (shift_address, lender_amount, settle_address, settle_amount) = data
        .sideshift
        .create_shift(
            offer.loan_asset_type,
            offer.loan_asset_chain,
            lender_amount,
            contract_id.to_string(),
            lender_ip.to_string(),
            body.bitcoin_refund_address.clone(),
            offer.loan_repayment_address.clone(),
        )
        .await
        .map_err(|err| {
            tracing::error!(contract_id, "Failed creating shift {err:#}");
            error_response(
                StatusCode::SERVICE_UNAVAILABLE,
                format!("Service unavailable {err:#}").as_str(),
            )
        })?;

    let contract_index = contract.contract_index.ok_or_else(|| {
        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error: missing contract index",
        )
    })?;

    let mut wallet = data.wallet.lock().await;
    let (collateral_descriptor, lender_pk, psbt) = contract_liquidation::prepare_liquidation_psbt(
        &mut wallet,
        contract,
        shift_address,
        lender_amount,
        contract_index,
        data.mempool.clone(),
        body.fee_rate_sats_vbyte,
    )
    .await
    .map_err(|err| {
        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{err:#}").as_str(),
        )
    })?;

    let psbt = psbt.serialize_hex();

    let res = LiquidationToStableCoinPsbt {
        psbt,
        collateral_descriptor,
        lender_pk,
        settle_address,
        settle_amount,
    };

    Ok(Json(res))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiquidationTx {
    pub tx: String,
}

// We don't need the lender to publish the liquidation TX through the hub, but it is convenient to
// be able to move the contract state forward. Eventually we could remove this and publish from the
// liquidation client.
#[instrument(skip(data, user), err(Debug), ret)]
async fn post_liquidation_tx(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
    Json(body): Json<LiquidationTx>,
) -> Result<String, (StatusCode, Json<ErrorResponse>)> {
    let belongs_to_lender = db::contracts::check_if_contract_belongs_to_lender(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {e:#}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    if !belongs_to_lender {
        let error_response = ErrorResponse {
            message: "Contract not found".to_string(),
        };
        return Err((StatusCode::NOT_FOUND, Json(error_response)));
    }

    let signed_claim_tx_str = body.tx;
    let signed_claim_tx: Transaction =
        bitcoin::consensus::encode::deserialize_hex(&signed_claim_tx_str).map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Failed to parse transaction: {e:#}"),
            };
            (StatusCode::BAD_REQUEST, Json(error_response))
        })?;
    let claim_txid = signed_claim_tx.compute_txid();

    data.mempool
        .send(mempool::TrackCollateralClaim {
            contract_id: contract_id.clone(),
            claim_txid,
        })
        .await
        .expect("actor to be alive")
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Failed to track transaction: {e:#}"),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    data.mempool
        .send(mempool::PostTx(signed_claim_tx_str))
        .await
        .expect("actor to be alive")
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Failed to post transaction: {e:#}"),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    // TODO: Use a database transaction.
    if let Err(e) =
        db::transactions::insert_liquidation_txid(&data.db, contract_id.as_str(), &claim_txid).await
    {
        tracing::error!("Failed to insert liquidation TXID: {e:#}");
    };

    if let Err(e) = db::contracts::mark_contract_as_closing(&data.db, contract_id.as_str()).await {
        tracing::error!("Failed to mark contract as closing: {e:#}");
    };

    let email = Email::new(data.config.clone());

    if let Err(e) = async {
        let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
            &data.db,
            contract_id.as_str(),
            &user.id,
        )
        .await
        .context("Contract not found")?;

        let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
            .await?
            .context("Borrower not found")?;

        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.borrower_frontend_origin.to_owned(),
            contract_id
        );
        email
            .send_loan_liquidated_after_default(borrower, loan_url.as_str())
            .await
            .context("Failed to send defaulted-loan-liquidated email")?;

        db::contract_emails::mark_defaulted_loan_liquidated_as_sent(&data.db, &contract.id)
            .await
            .context("Failed to mark defaulted-loan-liquidated email as sent")?;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!(
            "Failed at notifying borrower about loan liquidation due to default: {e:#}"
        );
    }

    Ok(claim_txid.to_string())
}

fn calculate_lender_liquidation_amount(
    loan_amount_usd: Decimal,
    yearly_interest_rate: Decimal,
    duration_months: u32,
    price: Decimal,
) -> anyhow::Result<Amount> {
    let owed_amount_usd = loan_amount_usd
        + calculate_interest(loan_amount_usd, yearly_interest_rate, duration_months);

    let owed_amount_btc = owed_amount_usd
        .checked_div(price)
        .ok_or_else(|| anyhow!("Division by zero"))?;

    let owed_amount_btc = owed_amount_btc.round_dp(8);
    let owed_amount_btc = owed_amount_btc.to_f64().expect("to fit");
    let owed_amount = Amount::from_btc(owed_amount_btc).expect("to fit");

    Ok(owed_amount)
}

/// Calculates the interest for the provided `duration_months`.
///
/// Note: does not compound interest
fn calculate_interest(
    loan_amount_usd: Decimal,
    yearly_interest_rate: Decimal,
    duration_months: u32,
) -> Decimal {
    let monthly_interest_rate = yearly_interest_rate / dec!(12);
    loan_amount_usd * monthly_interest_rate * Decimal::from(duration_months)
}

#[derive(Debug, Serialize)]
pub struct ManualRecoveryPsbt {
    pub psbt: String,
    pub collateral_descriptor: Descriptor<PublicKey>,
    pub lender_pk: PublicKey,
}

#[instrument(skip_all, fields(lender_id = user.id, contract_id), err(Debug), ret)]
async fn get_manual_recovery_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
    query_params: Query<LiquidationPsbtQueryParams>,
) -> Result<Json<ManualRecoveryPsbt>, (StatusCode, Json<ErrorResponse>)> {
    let mut wallet = data.wallet.lock().await;

    let lender_address = query_params
        .address
        .clone()
        .require_network(wallet.network())
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Invalid address: {e:#}"),
            };
            (StatusCode::BAD_REQUEST, Json(error_response))
        })?;

    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {e:#}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let ManualCollateralRecovery { lender_amount, .. } =
        db::manual_collateral_recovery::load_manual_collateral_recovery(&data.db, &contract.id)
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?
            .ok_or_else(|| {
                let error_response = ErrorResponse {
                    message: "Database error: invalid state to recover collateral manually"
                        .to_string(),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    let contract_index = contract.contract_index.ok_or_else(|| {
        let error_response = ErrorResponse {
            message: "Database error: missing contract index".to_string(),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let contract_address = contract.contract_address.ok_or_else(|| {
        let error_response = ErrorResponse {
            message: "Database error: missing contract address".to_string(),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let lender_xpub = contract.lender_xpub.ok_or_else(|| {
        let error_response = ErrorResponse {
            message: "Database error: missing lender Xpub".to_string(),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let collateral_outputs = data
        .mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        let error_response = ErrorResponse {
            message: "Database error: missing collateral outputs".to_string(),
        };

        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
    }

    let origination_fee = Amount::from_sat(contract.origination_fee_sats);

    let (psbt, collateral_descriptor, lender_pk) = wallet
        .create_liquidation_psbt(
            contract.borrower_pk,
            &lender_xpub,
            contract_index,
            collateral_outputs,
            origination_fee,
            lender_amount,
            lender_address,
            contract.borrower_btc_address.assume_checked(),
            query_params.fee_rate,
            contract.contract_version,
        )
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Database error: {e:#}"),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let psbt = psbt.serialize_hex();

    let res = ManualRecoveryPsbt {
        psbt,
        collateral_descriptor,
        lender_pk,
    };

    Ok(Json(res))
}

fn error_response(status: StatusCode, message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        status,
        Json(ErrorResponse {
            message: message.to_string(),
        }),
    )
}

/// Convert from a [`model::Contract`] to a [`crate::routes::borrower::Contract`].
async fn map_to_api_contract(
    data: &Arc<AppState>,
    contract: model::Contract,
) -> Result<Contract, Error> {
    let offer = db::loan_offers::loan_by_id(&data.db, &contract.loan_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLoanOffer {
            offer_id: contract.loan_id,
        })?;

    let borrower = db::borrowers::get_user_by_id(&data.db, &contract.borrower_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLender)?;

    let transactions = db::transactions::get_all_for_contract_id(&data.db, contract.id.as_str())
        .await
        .map_err(Error::Database)?;

    let repaid_at = transactions.iter().find_map(|tx| {
        matches!(tx.transaction_type, TransactionType::PrincipalRepaid).then_some(tx.timestamp)
    });

    let can_recover_collateral_manually =
        db::manual_collateral_recovery::load_manual_collateral_recovery(&data.db, &contract.id)
            .await
            .map_err(Error::Database)?
            .is_some();

    let parent_contract_id =
        db::contract_extensions::get_parent_by_extended(&data.db, contract.id.as_str())
            .await
            .map_err(|e| Error::Database(anyhow!(e)))?;
    let child_contract =
        db::contract_extensions::get_extended_by_parent(&data.db, contract.id.as_str())
            .await
            .map_err(|e| Error::Database(anyhow!(e)))?;

    let new_offer = offer;
    let interest_rate = if let Some(parent_id) = &parent_contract_id {
        let parent_contract = db::contracts::load_contract(&data.db, parent_id)
            .await
            .map_err(Error::Database)?;
        let old_offer = db::loan_offers::loan_by_id(&data.db, parent_contract.loan_id.as_str())
            .await
            .map_err(Error::Database)?
            .ok_or(Error::MissingLoanOffer {
                offer_id: parent_contract.loan_id,
            })?;

        crate::contract_extension::calculate_new_interest_rate(
            old_offer.interest_rate,
            contract.duration_months,
            new_offer.interest_rate,
            contract.duration_months,
        )
        .map_err(crate::contract_extension::Error::InterestRateCalculation)?
    } else {
        new_offer.interest_rate
    };

    let contract = Contract {
        id: contract.id,
        loan_amount: contract.loan_amount,
        duration_months: contract.duration_months,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        collateral_sats: contract.collateral_sats,
        interest_rate,
        initial_ltv: contract.initial_ltv,
        loan_asset_type: new_offer.loan_asset_type,
        loan_asset_chain: new_offer.loan_asset_chain,
        status: contract.status,
        borrower_pk: contract.borrower_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        loan_repayment_address: new_offer.loan_repayment_address,
        borrower: BorrowerProfile {
            id: borrower.id,
            name: borrower.name,
        },
        created_at: contract.created_at,
        updated_at: contract.updated_at,
        repaid_at,
        expiry: contract.expiry_date,
        liquidation_status: contract.liquidation_status,
        transactions,
        extends_contract: parent_contract_id,
        extended_by_contract: child_contract,
        can_recover_collateral_manually,
    };

    Ok(contract)
}

/// All the errors related to the `contracts` REST API.
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(anyhow::Error),
    /// Referenced loan does not exist.
    MissingLoanOffer { offer_id: String },
    /// Referenced lender does not exist.
    MissingLender,
    /// Can't do much of anything without lender Xpub.
    MissingLenderXpub,
    /// Loan extension was requested with an offer from a different lender which is currently not
    /// supported
    LoanOfferLenderMissmatch,
    /// We failed at calculating the interest rate. Cannot do much without this
    InterestRateCalculation(anyhow::Error),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(anyhow::Error),
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
            Error::Database(e) => {
                // If we configure `tracing` properly, we don't need to add extra context here!
                tracing::error!("Database error: {e:#}");

                // Don't expose any details about the error to the client.
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingLoanOffer { offer_id } => {
                tracing::error!(offer_id, "Could not find referenced loan offer");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingLender => {
                tracing::error!("Could not find referenced lender");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingOriginationFee => {
                tracing::error!("Missing origination fee");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::OriginationFeeCalculation(e) => {
                tracing::error!("Failed to calculate origination fee: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingLenderXpub => {
                tracing::error!("Missing lender Xpub");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::LoanOfferLenderMissmatch => (
                StatusCode::BAD_REQUEST,
                "Offer cannot be from a different lender".to_owned(),
            ),
            Error::InterestRateCalculation(e) => {
                tracing::error!("Failed at calculating interest rate {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
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

impl From<crate::contract_extension::Error> for Error {
    fn from(value: crate::contract_extension::Error) -> Self {
        match value {
            crate::contract_extension::Error::Database(e) => Error::Database(e),
            crate::contract_extension::Error::MissingLoanOffer { offer_id } => {
                Error::MissingLoanOffer { offer_id }
            }
            crate::contract_extension::Error::LoanOfferLenderMismatch => {
                Error::LoanOfferLenderMissmatch
            }
            crate::contract_extension::Error::InterestRateCalculation(e) => {
                Error::InterestRateCalculation(e)
            }
            crate::contract_extension::Error::MissingOriginationFee => Error::MissingOriginationFee,
            crate::contract_extension::Error::OriginationFeeCalculation(e) => {
                Error::OriginationFeeCalculation(e)
            }
            crate::contract_extension::Error::MissingLenderXpub => Error::MissingLenderXpub,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_lender_liquidation_amount() {
        let loan_amount_usd = dec!(1_000);
        let yearly_interest_rate = dec!(0.12);
        let duration_months = 3;
        let price = dec!(100_000);

        let amount = calculate_lender_liquidation_amount(
            loan_amount_usd,
            yearly_interest_rate,
            duration_months,
            price,
        )
        .unwrap();

        assert_eq!(amount.to_sat(), 1_030_000);

        let loan_amount_usd = dec!(10_000);
        let yearly_interest_rate = dec!(0.20);
        let duration_months = 18;
        let price = dec!(50_000);

        let amount = calculate_lender_liquidation_amount(
            loan_amount_usd,
            yearly_interest_rate,
            duration_months,
            price,
        )
        .unwrap();

        assert_eq!(amount.to_sat(), 26_000_000);

        let loan_amount_usd = dec!(1_000);
        let yearly_interest_rate = dec!(0.12);
        let duration_months = 12;
        let price = dec!(0);

        let res = calculate_lender_liquidation_amount(
            loan_amount_usd,
            yearly_interest_rate,
            duration_months,
            price,
        );

        assert!(res.is_err())
    }

    #[test]
    fn test_calculate_interest() {
        let loan_amount_usd = dec!(1_000);
        let yearly_interest_rate = dec!(0.12);

        let duration_months = 3;
        let amount = calculate_interest(loan_amount_usd, yearly_interest_rate, duration_months);

        assert_eq!(amount, dec!(30));

        let duration_months = 12;
        let amount = calculate_interest(loan_amount_usd, yearly_interest_rate, duration_months);

        assert_eq!(amount, dec!(120));

        let duration_months = 15;
        let amount = calculate_interest(loan_amount_usd, yearly_interest_rate, duration_months);

        assert_eq!(amount, dec!(150));
    }
}
