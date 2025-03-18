use crate::approve_contract;
use crate::approve_contract::approve_contract;
use crate::bitmex_index_price_rest::get_bitmex_index_price;
use crate::contract_requests;
use crate::db;
use crate::discounted_origination_fee;
use crate::mempool;
use crate::model;
use crate::model::Borrower;
use crate::model::ContractRequestSchema;
use crate::model::ContractStatus;
use crate::model::ContractVersion;
use crate::model::FiatLoanDetails;
use crate::model::LiquidationStatus;
use crate::model::LoanAsset;
use crate::model::LoanTransaction;
use crate::model::LoanType;
use crate::model::PsbtQueryParams;
use crate::model::TransactionType;
use crate::moon::MOON_CARD_MAX_BALANCE;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::CONTRACTS_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use crate::user_stats;
use crate::user_stats::LenderStats;
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
use axum::Extension;
use axum::Json;
use bitcoin::bip32::DerivationPath;
use bitcoin::bip32::Xpub;
use bitcoin::consensus::encode::FromHexError;
use bitcoin::Amount;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use miniscript::Descriptor;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::str::FromStr;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;
use url::Url;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

pub(crate) fn router_openapi(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_contracts))
        .routes(routes!(get_contract))
        .routes(routes!(get_claim_collateral_psbt))
        .routes(routes!(post_contract_request))
        .routes(routes!(post_claim_tx))
        .routes(routes!(post_extend_contract_request))
        .routes(routes!(put_repayment_provided))
        .routes(routes!(cancel_contract_request))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

/// Post a contract request
///
/// A contract request will be sent to the lender.
#[utoipa::path(
post,
request_body = ContractRequestSchema,
path = "/",
tag = CONTRACTS_TAG,
responses(
    (
        status = 200,
        description = "The successfully requested contract",
        body = Contract
    )
),
security(
    (
    "api_key" = []
    )
)
)]
#[instrument(skip_all, err(Debug))]
async fn post_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<ContractRequestSchema>,
) -> Result<AppJson<Contract>, Error> {
    let offer = db::loan_offers::loan_by_id(&data.db, &body.loan_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLoanOffer {
            offer_id: body.loan_id.clone(),
        })?;

    if !offer.is_valid_loan_duration(body.duration_days) {
        return Err(Error::InvalidLoanDuration {
            duration_days: body.duration_days,
            duration_days_min: offer.duration_days_min,
            duration_days_max: offer.duration_days_max,
        });
    }

    if !offer.is_valid_loan_amount(body.loan_amount) {
        return Err(Error::InvalidLoanAmount {
            amount: body.loan_amount,
            loan_amount_min: offer.loan_amount_min,
            loan_amount_max: offer.loan_amount_max,
        });
    }

    let contract_id = Uuid::new_v4();
    let lender_id = &offer.lender_id;

    let is_kyc_required = offer.requires_kyc();

    if is_kyc_required {
        // TODO: this should be a db transaction
        db::kyc::insert(&data.db, lender_id, &user.id)
            .await
            .map_err(Error::Database)?;
    }

    let (borrower_loan_address, moon_invoice, fiat_loan_details) = match body.loan_type {
        LoanType::StableCoin => match body.borrower_loan_address {
            Some(borrower_loan_address) => (Some(borrower_loan_address), None, None),
            None => return Err(Error::MissingBorrowerLoanAddress),
        },
        LoanType::PayWithMoon => {
            if offer.loan_asset != LoanAsset::UsdcPol {
                return Err(Error::InvalidMoonLoanRequest {
                    asset: offer.loan_asset,
                });
            }

            let card_id = match body.moon_card_id {
                // This is a top-up.
                Some(card_id) => {
                    let loan_amount = body.loan_amount;

                    let card = db::moon::get_card_by_id(&data.db, &card_id.to_string())
                        .await
                        .map_err(Error::Database)?
                        .ok_or(Error::CannotTopUpNonexistentCard)?;

                    let current_balance = card.balance;
                    if current_balance + loan_amount > MOON_CARD_MAX_BALANCE {
                        return Err(Error::CannotTopUpOverLimit {
                            current_balance,
                            loan_amount,
                            limit: MOON_CARD_MAX_BALANCE,
                        });
                    }

                    let client_ip = connection_details
                        .ip
                        .ok_or(Error::CannotTopUpMoonCardWithoutIp)?;

                    let is_us_ip = is_us_ip(&client_ip).await.map_err(Error::GeoJs)?;

                    if is_us_ip {
                        return Err(Error::CannotTopUpMoonCardFromUs);
                    } else {
                        card_id
                    }
                }
                // This is a new card.
                None => {
                    let card = data
                        .moon
                        .create_card(user.id.clone())
                        .await
                        .map_err(Error::MoonCardGeneration)?;

                    card.id
                }
            };

            let invoice = data
                .moon
                .generate_invoice(
                    body.loan_amount,
                    contract_id.to_string(),
                    card_id,
                    lender_id.clone(),
                    user.id.as_str(),
                )
                .await
                .map_err(Error::MoonInvoiceGeneration)?;

            (Some(invoice.address.clone()), Some(invoice), None)
        }
        LoanType::Fiat => {
            if !offer.loan_asset.is_fiat() {
                return Err(Error::FiatLoanWithoutFiatAsset {
                    asset: offer.loan_asset,
                });
            }

            let fiat_loan_details = body
                .fiat_loan_details
                .ok_or(Error::MissingFiatLoanDetails)?;

            (None, None, Some(fiat_loan_details))
        }
    };

    let initial_price = get_bitmex_index_price(OffsetDateTime::now_utc())
        .await
        .map_err(Error::BitMexPrice)?;

    let min_ltv = offer.min_ltv;
    let initial_collateral = calculate_initial_collateral(body.loan_amount, min_ltv, initial_price)
        .map_err(Error::InitialCollateralCalculation)?;

    // TODO: Choose origination fee based on loan parameters. For now we only have one origination
    // fee anyway.
    let origination_fee = data
        .config
        .origination_fee
        .first()
        .ok_or(Error::MissingOriginationFee)?;

    // If the user has a discount code, we reduce the origination fee for him
    let origination_fee_rate =
        discounted_origination_fee::calculate_discounted_origination_fee_rate(
            &data.db,
            origination_fee.fee,
            user.id.as_str(),
        )
        .await
        .map_err(Error::from)?;

    let origination_fee_amount = contract_requests::calculate_origination_fee(
        body.loan_amount,
        origination_fee_rate,
        initial_price,
    )
    .map_err(Error::OriginationFeeCalculation)?;

    let lender_xpub = offer.lender_xpub;
    let lender_xpub = Xpub::from_str(&lender_xpub).expect("valid lender Xpub");
    let contract = db::contracts::insert_new_contract_request(
        &data.db,
        contract_id,
        user.id.as_str(),
        lender_id.as_str(),
        &body.loan_id,
        min_ltv,
        initial_collateral.to_sat(),
        origination_fee_amount.to_sat(),
        body.loan_amount,
        body.duration_days,
        body.borrower_btc_address,
        body.borrower_xpub,
        borrower_loan_address.as_deref(),
        body.loan_type,
        lender_xpub,
        ContractVersion::TwoOfThree,
        offer.interest_rate,
    )
    .await
    .map_err(Error::Database)?;

    if let Some(fiat_loan_details) = fiat_loan_details {
        if fiat_loan_details.details.swift_transfer_details.is_none()
            && fiat_loan_details.details.iban_transfer_details.is_none()
        {
            return Err(Error::MissingFiatLoanDetails);
        }

        db::fiat_loan_details::insert_borrower(
            &data.db,
            contract_id.to_string().as_str(),
            fiat_loan_details,
        )
        .await
        .map_err(Error::Database)?;
    }

    let contract = map_to_api_contract(&data, contract).await?;

    if let Some(invoice) = moon_invoice {
        data.moon
            .persist_invoice(&invoice)
            .await
            .map_err(Error::Database)?;
    }

    // We only want to auto-accept offers if KYC is not required and it is not a fiat loan. The
    // reason is that we need to collect banking details of the lender during approval process
    if offer.auto_accept && (!is_kyc_required && !offer.loan_asset.is_fiat()) {
        approve_contract(
            &data.db,
            &data.wallet,
            &data.mempool,
            &data.config,
            contract.id.clone(),
            lender_id,
            data.notifications.clone(),
            None,
        )
        .await
        .map_err(Error::from)?;
    }

    let lender_loan_url = format!(
        "{}/my-contracts/{}",
        data.config.lender_frontend_origin.to_owned(),
        contract.id
    );

    // We don't want to fail this upwards because the contract request has been sent already.
    if let Err(e) = async {
        let lender = db::lenders::get_user_by_id(&data.db, &contract.lender.id)
            .await?
            .context("Failed to find lender")?;

        let lender_id = lender.id.clone();
        let borrower_id = user.id.clone();
        if offer.auto_accept {
            data.notifications
                .send_notification_about_auto_accepted_loan(lender, lender_loan_url.as_str())
                .await;

            db::contract_emails::mark_auto_accept_email_as_sent(&data.db, &contract.id)
                .await
                .context("Failed to mark loan-auto-accept email as sent")?;

            tracing::info!(
                contract_id = contract_id.to_string(),
                borrower_id,
                lender_id,
                "Contract request has been automatically approved"
            );
        } else {
            data.notifications
                .send_new_loan_request(lender, lender_loan_url.as_str())
                .await;

            db::contract_emails::mark_loan_request_as_sent(&data.db, &contract.id)
                .await
                .context("Failed to mark loan-request email as sent")?;
            tracing::info!(
                contract_id = contract_id.to_string(),
                borrower_id,
                lender_id,
                "Contract request notification sent"
            );
        }

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying lender about loan request: {e:#}");
    }

    Ok(AppJson(contract))
}

/// Cancel a request
#[utoipa::path(
delete,
path = "/{id}",
params(
    (
    "id" = String, Path, description = "Contract id"
    )
),
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "If OK HTTP 200 is returned",
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip(data, user), err(Debug), ret)]
async fn cancel_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    if contract.status != ContractStatus::Requested
        && contract.status != ContractStatus::RenewalRequested
    {
        return Err(Error::InvalidCancelRequest {
            status: contract.status,
        });
    }

    // TODO(bonomat): make use of database transaction
    if contract.status == ContractStatus::RenewalRequested {
        let parent =
            db::contract_extensions::get_parent_by_extended(&data.db, contract_id.as_str())
                .await
                .map_err(|e| Error::Database(anyhow!(e)))?
                .ok_or(Error::MissingParentContract(contract_id.clone()))?;
        db::contracts::cancel_extension(&data.db, parent.as_str())
            .await
            .map_err(Error::Database)?;
        db::contract_extensions::delete_with_parent(&data.db, parent.as_str())
            .await
            .map_err(|e| Error::Database(anyhow!(e)))?;
    }

    db::contracts::mark_contract_as_cancelled(&data.db, contract_id.as_str())
        .await
        .map_err(Error::Database)?;

    Ok(())
}

/// Get all personal contracts
#[utoipa::path(
get,
path = "/",
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "A list of contracts",
    body = [Contract]
    )
),
security(
    (
    "api_key" = [])
    )
)
]
async fn get_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
) -> Result<AppJson<Vec<Contract>>, Error> {
    let contracts = db::contracts::load_contracts_by_borrower_id(&data.db, user.id.as_str())
        .await
        .map_err(Error::Database)?;

    let mut contracts_api = Vec::new();
    for contract in contracts {
        let contract = map_to_api_contract(&data, contract).await?;

        contracts_api.push(contract);
    }

    Ok(AppJson(contracts_api))
}

/// Get a contract by id
#[utoipa::path(
get,
path = "/{id}",
params(
    (
    "id" = String, Path, description = "Contract id"
    )
),
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "If present, the contract details",
    body = Contract
    )
),
security(
    (
    "api_key" = [])
    )
)
]
async fn get_contract(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
) -> Result<AppJson<Contract>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(Error::Database)?;

    let contract = map_to_api_contract(&data, contract).await?;

    Ok(AppJson(contract))
}

/// Marks a contract as repaid.
#[utoipa::path(
put,
path = "/{id}/repaid",
params(
    (
    "id" = String, Path, description = "Contract id"
    )
),
request_body = PrincipalRepaidQueryParam,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    )
),
security(
    (
    "api_key" = [])
    )
    )
]
#[instrument(skip(data, user), err(Debug))]
async fn put_repayment_provided(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    query_params: Query<PrincipalRepaidQueryParam>,
    Extension(user): Extension<Borrower>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(Error::Database)?;

    // TODO: Use a database transaction.
    db::contracts::mark_contract_as_repayment_provided(&data.db, contract.id.as_str())
        .await
        .map_err(Error::Database)?;

    db::transactions::insert_principal_repaid_txid(
        &data.db,
        contract_id.as_str(),
        query_params.txid.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    let loan_url = format!(
        "{}/my-contracts/{}",
        data.config.lender_frontend_origin.to_owned(),
        contract.id
    );

    if let Err(e) = async {
        let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
            .await?
            .context("Failed to find lender")?;

        data.notifications
            .send_loan_repaid(lender, loan_url.as_str())
            .await;

        db::contract_emails::mark_loan_repaid_as_sent(&data.db, &contract.id)
            .await
            .context("Failed to mark loan repaid email as sent")?;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying lender about loan repayment: {e:#}");
    }

    Ok(())
}

// This API is only needed for the version of the protocol _without_ DLCs. With DLCs, the borrower
// will be able to unilaterally reclaim the collateral after they learn the loan secret.
/// Get the claim transaction
#[utoipa::path(
get,
path = "/{id}/claim",
params(
    (
    "id" = String, Path, description = "Contract id"
    )
),
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    body = ClaimCollateralPsbt,
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id), err(Debug), ret)]
async fn get_claim_collateral_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    query_params: Query<PsbtQueryParams>,
) -> Result<AppJson<ClaimCollateralPsbt>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(Error::Database)?;

    if contract.status != ContractStatus::RepaymentConfirmed {
        return Err(Error::PrincipalNotRepaid);
    }

    let contract_index = contract.contract_index.ok_or(Error::MissingContractIndex)?;

    let contract_address = contract
        .contract_address
        .ok_or(Error::MissingCollateralAddress)?;

    let lender_xpub = contract.lender_xpub.ok_or(Error::MissingLenderXpub)?;

    let collateral_outputs = data
        .mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        return Err(Error::MissingCollateralOutputs);
    }

    let origination_fee = Amount::from_sat(contract.origination_fee_sats);

    let (psbt, collateral_descriptor, borrower_pk) = data
        .wallet
        .create_claim_collateral_psbt(
            &contract.borrower_xpub,
            contract.borrower_pk,
            &lender_xpub,
            contract_index,
            collateral_outputs,
            origination_fee.to_sat(),
            contract.borrower_btc_address.assume_checked(),
            query_params.fee_rate,
            contract.contract_version,
        )
        .map_err(Error::CreateClaimCollateralPsbt)?;

    let psbt = psbt.serialize_hex();

    let res = ClaimCollateralPsbt {
        psbt,
        collateral_descriptor,
        borrower_pk,
    };

    Ok(AppJson(res))
}

// We don't need the borrower to publish the claim TX through the hub, but it is convenient to be
// able to move the contract state forward. Eventually we could remove this and publish from the
// borrower client.
/// Get all personal contracts
#[utoipa::path(
post,
path = "/{id}",
params(
    (
    "id" = String, Path, description = "Contract id"
    )
),
request_body = ClaimTx,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Transaction ID of successfully posted transaction",
    body = String
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip(data, user), err(Debug), ret)]
async fn post_claim_tx(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<ClaimTx>,
) -> Result<String, Error> {
    let belongs_to_borrower = db::contracts::check_if_contract_belongs_to_borrower(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(Error::Database)?;

    if !belongs_to_borrower {
        return Err(Error::NotYourContract);
    }

    let signed_claim_tx_str = body.tx;
    let signed_claim_tx: Transaction =
        bitcoin::consensus::encode::deserialize_hex(&signed_claim_tx_str)
            .map_err(Error::ParseClaimTx)?;
    let claim_txid = signed_claim_tx.compute_txid();

    data.mempool
        .send(mempool::TrackCollateralClaim {
            contract_id: contract_id.clone(),
            claim_txid,
        })
        .await
        .expect("actor to be alive")
        .map_err(Error::TrackClaimTx)?;

    data.mempool
        .send(mempool::PostTx(signed_claim_tx_str))
        .await
        .expect("actor to be alive")
        .map_err(Error::PostClaimTx)?;

    // TODO: Use a database transaction.
    db::transactions::insert_claim_txid(&data.db, contract_id.as_str(), &claim_txid)
        .await
        .map_err(Error::Database)?;
    db::contracts::mark_contract_as_closing(&data.db, contract_id.as_str())
        .await
        .map_err(Error::Database)?;

    Ok(claim_txid.to_string())
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
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
    pub initial_ltv: Decimal,
    pub loan_asset: LoanAsset,
    pub status: ContractStatus,
    #[schema(value_type = String)]
    pub borrower_pk: Option<PublicKey>,
    pub borrower_btc_address: String,
    pub borrower_loan_address: Option<String>,
    pub contract_address: Option<String>,
    pub collateral_script: Option<String>,
    #[schema(value_type = String)]
    pub derivation_path: Option<DerivationPath>,
    pub loan_repayment_address: String,
    pub lender: LenderStats,
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
    pub loan_type: LoanType,
    #[serde(with = "rust_decimal::serde::float")]
    pub liquidation_price: Decimal,
    pub extends_contract: Option<String>,
    pub extended_by_contract: Option<String>,
    pub borrower_xpub: String,
    pub lender_xpub: String,
    pub kyc_info: Option<KycInfo>,
    pub fiat_loan_details_borrower: Option<FiatLoanDetailsWrapper>,
    pub fiat_loan_details_lender: Option<FiatLoanDetailsWrapper>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FiatLoanDetailsWrapper {
    pub details: FiatLoanDetails,
    /// The borrower's encrypted encryption key.
    pub encrypted_encryption_key: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct KycInfo {
    kyc_link: Url,
    is_kyc_done: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClaimCollateralPsbt {
    pub psbt: String,
    #[schema(value_type = String)]
    pub collateral_descriptor: Descriptor<PublicKey>,
    #[schema(value_type = String)]
    pub borrower_pk: PublicKey,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClaimTx {
    pub tx: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct PrincipalRepaidQueryParam {
    pub txid: String,
}

fn calculate_initial_collateral(
    loan_amount: Decimal,
    ltv: Decimal,
    initial_price: Decimal,
) -> anyhow::Result<Amount> {
    let collateral_value_usd = loan_amount
        .checked_div(ltv)
        .context("Failed to calculate collateral in USD")?;

    let collateral_btc = collateral_value_usd
        .checked_div(initial_price)
        .context("Failed to calculate collateral in BTC")?;

    let collateral_btc = collateral_btc.round_dp(8);
    let collateral_btc = collateral_btc.to_f64().expect("to fit");

    Ok(Amount::from_btc(collateral_btc).expect("to fit"))
}

/// Convert from a [`model::Contract`] to a [`Contract`].
async fn map_to_api_contract(
    data: &Arc<AppState>,
    contract: model::Contract,
) -> Result<Contract, Error> {
    let offer = db::loan_offers::loan_by_id(&data.db, &contract.loan_id)
        .await
        .map_err(Error::Database)?
        .ok_or_else(|| Error::MissingLoanOffer {
            offer_id: contract.loan_id.clone(),
        })?;

    let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLender)?;

    let transactions = db::transactions::get_all_for_contract_id(&data.db, contract.id.as_str())
        .await
        .map_err(Error::Database)?;

    let repaid_at = transactions.iter().find_map(|tx| {
        matches!(tx.transaction_type, TransactionType::PrincipalRepaid).then_some(tx.timestamp)
    });

    let liquidation_price = contract.liquidation_price();

    let parent_contract_id =
        db::contract_extensions::get_parent_by_extended(&data.db, contract.id.as_str())
            .await
            .map_err(|e| Error::Database(anyhow!(e)))?;
    let child_contract =
        db::contract_extensions::get_extended_by_parent(&data.db, contract.id.as_str())
            .await
            .map_err(|e| Error::Database(anyhow!(e)))?;

    let kyc_info = match offer.kyc_link {
        Some(ref kyc_link) => {
            let is_kyc_done = db::kyc::get(&data.db, &lender.id, &contract.borrower_id)
                .await
                .map_err(Error::Database)?;

            Some(KycInfo {
                kyc_link: kyc_link.clone(),
                is_kyc_done: is_kyc_done.unwrap_or(false),
            })
        }
        None => None,
    };

    let new_offer = offer;

    let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
        .await
        .map_err(Error::from)?;

    let lender_xpub = db::wallet_backups::get_xpub_for_lender(&data.db, contract.lender_id)
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    let fiat_loan_details_borrower = {
        let details = db::fiat_loan_details::get_borrower(&data.db, &contract.id)
            .await
            .map_err(Error::Database)?;

        details.map(|d| FiatLoanDetailsWrapper {
            details: d.details,
            encrypted_encryption_key: d.encrypted_encryption_key_borrower,
        })
    };

    let fiat_loan_details_lender = {
        let details = db::fiat_loan_details::get_lender(&data.db, &contract.id)
            .await
            .map_err(Error::Database)?;

        details.map(|d| FiatLoanDetailsWrapper {
            details: d.details,
            encrypted_encryption_key: d.encrypted_encryption_key_borrower,
        })
    };

    let (collateral_script, borrower_pk, borrower_derivation_path) = match contract.contract_index {
        Some(contract_index) => {
            let (collateral_descriptor, (borrower_pk, borrower_derivation_path), _) = data
                .wallet
                .collateral_descriptor(
                    &contract.borrower_xpub,
                    contract.borrower_pk,
                    &lender_xpub,
                    contract.contract_version,
                    contract_index,
                )
                .map_err(Error::CannotBuildDescriptor)?;
            let collateral_script = collateral_descriptor.script_code().expect("not taproot");
            let collateral_script = collateral_script.to_hex_string();

            (
                Some(collateral_script),
                Some(borrower_pk),
                borrower_derivation_path,
            )
        }
        None => (None, contract.borrower_pk, None),
    };

    let contract = Contract {
        id: contract.id,
        loan_amount: contract.loan_amount,
        duration_days: contract.duration_days,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        collateral_sats: contract.collateral_sats,
        interest_rate: contract.interest_rate,
        initial_ltv: contract.initial_ltv,
        loan_asset: new_offer.loan_asset,
        status: contract.status,
        borrower_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        collateral_script,
        derivation_path: borrower_derivation_path,
        loan_repayment_address: new_offer.loan_repayment_address,
        lender: lender_stats,
        created_at: contract.created_at,
        updated_at: contract.updated_at,
        repaid_at,
        expiry: contract.expiry_date,
        liquidation_status: contract.liquidation_status,
        transactions,
        loan_type: contract.loan_type,
        liquidation_price,
        extends_contract: parent_contract_id,
        extended_by_contract: child_contract,
        borrower_xpub: contract.borrower_xpub.to_string(),
        lender_xpub: lender_xpub.to_string(),
        kyc_info,
        fiat_loan_details_borrower,
        fiat_loan_details_lender,
    };

    Ok(contract)
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ExtendContractRequestSchema {
    pub loan_id: String,
    pub new_duration: i32,
}

/// Post a request to extend the contract
#[utoipa::path(
post,
path = "/{id}/extend",
params(
    (
    "id" = String, Path, description = "Contract id"
    )
),
request_body = PrincipalRepaidQueryParam,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    body = Contract,
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn post_extend_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<ExtendContractRequestSchema>,
) -> Result<AppJson<Contract>, Error> {
    let current_price = get_bitmex_index_price(OffsetDateTime::now_utc())
        .await
        .map_err(Error::BitMexPrice)?;

    let new_contract = crate::contract_extension::request_contract_extension(
        &data.db,
        &data.config,
        contract_id.as_str(),
        body.loan_id.as_str(),
        user.id.as_str(),
        body.new_duration,
        current_price,
    )
    .await
    .map_err(Error::from)?;

    let contract = map_to_api_contract(&data, new_contract).await?;

    Ok(AppJson(contract))
}

async fn is_us_ip(ip: &str) -> anyhow::Result<bool> {
    #[derive(Deserialize)]
    struct GeoInfo {
        country: Option<String>,
    }

    // Local development address can be ignored.
    if ip == "127.0.0.1" {
        return Ok(false);
    }

    let url = format!("https://get.geojs.io/v1/ip/country/{ip}.json");
    let response = reqwest::get(&url).await?;
    let geo_info: GeoInfo = response.json().await?;

    let country_code = geo_info.country.context("Missing country code")?;

    Ok(country_code == "US")
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
    /// Failed to provide borrower loan address for stablecoin loan.
    MissingBorrowerLoanAddress,
    /// Moon only supports USDC on Polygon.
    InvalidMoonLoanRequest { asset: LoanAsset },
    /// The Moon card that the borrower is trying to top up does not exist.
    CannotTopUpNonexistentCard,
    /// The attempt to top up the card would push the balance over the limit.
    CannotTopUpOverLimit {
        current_balance: Decimal,
        loan_amount: Decimal,
        limit: Decimal,
    },
    /// Moon cards cannot be topped up if we don't know the client IP.
    CannotTopUpMoonCardWithoutIp,
    /// Failed to get country code of IP from GeoJS.
    GeoJs(anyhow::Error),
    /// Moon cards cannot be topped up from the US.
    CannotTopUpMoonCardFromUs,
    /// Failed to create Moon card.
    MoonCardGeneration(anyhow::Error),
    /// Failed to generate Moon invoice.
    MoonInvoiceGeneration(anyhow::Error),
    /// Failed to get price from BitMEX.
    BitMexPrice(anyhow::Error),
    /// Failed to calculate initial collateral.
    InitialCollateralCalculation(anyhow::Error),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(anyhow::Error),
    /// Can't approve a contract request with a [`ContractStatus`] different to
    /// [`ContractStatus::Requested`] or [`ContractStatus::RenewalRequested`].
    InvalidApproveRequest { status: ContractStatus },
    /// Can't cancel a contract request with a [`ContractStatus`] different to
    /// [`ContractStatus::Requested`] or [`ContractStatus::RenewalRequested`].
    InvalidCancelRequest { status: ContractStatus },
    /// Can't claim collateral if principal has not been repaid.
    PrincipalNotRepaid,
    /// Can't claim collateral without contract index.
    MissingContractIndex,
    /// Can't claim collateral without collateral address.
    MissingCollateralAddress,
    /// Can't do much of anything without borrower Xpub.
    MissingBorrowerXpub,
    /// Can't do much of anything without lender Xpub.
    MissingLenderXpub,
    /// Failed to generate contract address.
    ContractAddress(anyhow::Error),
    /// Referenced borrower does not exist.
    MissingBorrower,
    /// Failed to track accepted contract using Mempool API.
    TrackContract(anyhow::Error),
    /// Can't find collateral outputs to claim.
    MissingCollateralOutputs,
    /// Failed to create claim-collateral PSBT.
    CreateClaimCollateralPsbt(anyhow::Error),
    /// Failed to parse signed claim-collateral transaction.
    ParseClaimTx(FromHexError),
    /// Failed to track claim-collateral transaction.
    TrackClaimTx(anyhow::Error),
    /// Failed to post claim-collateral transaction.
    PostClaimTx(anyhow::Error),
    /// The borrower is trying to interact with a contract that is not theirs, according to our
    /// records.
    NotYourContract,
    /// Loan extension was requested with an offer from a different lender which is currently not
    /// supported
    LoanOfferLenderMismatch,
    /// We failed at calculating the interest rate. Cannot do much without this
    InterestRateCalculation(anyhow::Error),
    /// Can't cancel a extend contract request if the parent does not exist
    MissingParentContract(String),
    /// Discounted origination fee rate was not valid
    InvalidDiscountRate { fee: Decimal },
    /// A fiat loan must use a fiat asset.
    FiatLoanWithoutFiatAsset { asset: LoanAsset },
    /// A request for a fiat loan offer does not include the necessary fiat loan details.
    MissingFiatLoanDetails,
    InvalidLoanAmount {
        amount: Decimal,
        loan_amount_min: Decimal,
        loan_amount_max: Decimal,
    },
    InvalidLoanDuration {
        duration_days: i32,
        duration_days_min: i32,
        duration_days_max: i32,
    },
    /// Failed to build contract descriptor.
    CannotBuildDescriptor(anyhow::Error),
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
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
            Error::MissingBorrowerLoanAddress => (
                StatusCode::BAD_REQUEST,
                "Failed to provide borrower loan address for stablecoin loan".to_owned(),
            ),
            Error::InvalidMoonLoanRequest { asset } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Cannot create loan request for Moon card with asset {asset:?}. \
                     Moon only supports USDC on Polygon"
                ),
            ),
            Error::CannotTopUpNonexistentCard => {
                (StatusCode::NOT_FOUND, "Card not found".to_owned())
            }
            Error::CannotTopUpOverLimit {
                current_balance,
                loan_amount,
                limit,
            } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Invalid Moon card top-up request: current balance ({current_balance}) \
                     + loan amount ({loan_amount}) > limit ({limit})"
                ),
            ),
            Error::CannotTopUpMoonCardWithoutIp => (
                StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
                "Request IP required".to_owned(),
            ),
            Error::GeoJs(e) => {
                tracing::error!("Failed to top up Moon card: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::CannotTopUpMoonCardFromUs => (
                StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
                "Cannot top up Moon card from the US".to_owned(),
            ),
            Error::MoonCardGeneration(e) => {
                tracing::error!("Failed to generate Moon card: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MoonInvoiceGeneration(e) => {
                tracing::error!("Failed to generate Moon invoice: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::BitMexPrice(e) => {
                tracing::error!("Failed to get price from BitMEX: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::InitialCollateralCalculation(e) => {
                tracing::error!("Failed to calculate initial collateral: {e:#}");

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
            Error::InvalidCancelRequest { status } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot cancel a contract request with status {status:?}"),
            ),
            Error::PrincipalNotRepaid => (
                StatusCode::BAD_REQUEST,
                "Cannot claim collateral until loan has been repaid".to_owned(),
            ),
            Error::MissingContractIndex => {
                tracing::error!("Missing contract index");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingCollateralAddress => {
                tracing::error!("Missing collateral address");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingBorrowerXpub => {
                tracing::error!("Missing borrower Xpub");

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
            Error::ContractAddress(e) => {
                tracing::error!("Could not generate contract address: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingBorrower => {
                tracing::error!("Could not find referenced borrower");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::TrackContract(e) => {
                tracing::error!("Failed to track accepted contract: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingCollateralOutputs => {
                tracing::error!("Could not find collateral outputs to claim");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::CreateClaimCollateralPsbt(e) => {
                tracing::error!("Could not create claim-collateral PSBT: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::ParseClaimTx(e) => {
                tracing::error!("Failed to parse signed claim-collateral TX: {e:#}");
                (
                    StatusCode::BAD_REQUEST,
                    "Failed to parse signed claim TX".to_owned(),
                )
            }
            Error::TrackClaimTx(e) => {
                tracing::error!("Failed to track claim-collateral transaction: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::PostClaimTx(e) => {
                tracing::error!("Failed to post claim-collateral transaction: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::NotYourContract => (StatusCode::NOT_FOUND, "Contract not found".to_owned()),
            Error::LoanOfferLenderMismatch => (
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
            Error::MissingParentContract(contract_id) => {
                tracing::error!(
                    contract_id,
                    "Failed at cancelling contract extension request as contract was not extended"
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::InvalidApproveRequest { status } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot cancel a contract request with status {status:?}"),
            ),
            Error::InvalidDiscountRate { fee } => {
                tracing::error!(fee = fee.to_string(), "Invalid origination fee discount");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingFiatLoanDetails => (
                StatusCode::BAD_REQUEST,
                "Failed to provide bank details for fiat loan".to_owned(),
            ),
            Error::FiatLoanWithoutFiatAsset { asset } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot create fiat contract with asset: {asset:?}"),
            ),
            Error::InvalidLoanAmount {
                amount,
                loan_amount_min,
                loan_amount_max,
            } => (
                StatusCode::BAD_REQUEST,
                format!("Invalid loan amount: ${amount} not in range ${loan_amount_min}-${loan_amount_max}"),
            ),
            Error::InvalidLoanDuration { duration_days, duration_days_min, duration_days_max } => (
                StatusCode::BAD_REQUEST,
                format!("Invalid loan duration: {duration_days} days not in range {duration_days_min}-{duration_days_max}"),
            ),
            Error::CannotBuildDescriptor(e) => {
                tracing::error!("Failed to build collateral descriptor: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

impl From<approve_contract::Error> for Error {
    fn from(value: approve_contract::Error) -> Self {
        match value {
            approve_contract::Error::Database(e) => Error::Database(e),
            approve_contract::Error::MissingBorrowerXpub => Error::MissingBorrowerXpub,
            approve_contract::Error::MissingLenderXpub => Error::MissingLenderXpub,
            approve_contract::Error::MissingLoanOffer { offer_id } => {
                Error::MissingLoanOffer { offer_id }
            }
            approve_contract::Error::MissingFiatLoanDetails => Error::MissingFiatLoanDetails,
            approve_contract::Error::ContractAddress(e) => Error::ContractAddress(e),
            approve_contract::Error::MissingBorrower => Error::MissingBorrower,
            approve_contract::Error::TrackContract(e) => Error::TrackContract(e),
            approve_contract::Error::InvalidApproveRequest { status } => {
                Error::InvalidApproveRequest { status }
            }
        }
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
                Error::LoanOfferLenderMismatch
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

impl From<discounted_origination_fee::Error> for Error {
    fn from(value: discounted_origination_fee::Error) -> Self {
        match value {
            discounted_origination_fee::Error::InvalidDiscountRate { fee } => {
                Error::InvalidDiscountRate { fee }
            }
            discounted_origination_fee::Error::Database(sql_error) => {
                Error::Database(anyhow!(sql_error))
            }
        }
    }
}

impl From<user_stats::Error> for Error {
    fn from(value: user_stats::Error) -> Self {
        match value {
            user_stats::Error::Database(e) => Error::Database(anyhow!(e)),
        }
    }
}
