use crate::db;
use crate::email::Email;
use crate::mempool;
use crate::model;
use crate::model::ContractRequestSchema;
use crate::model::ContractStatus;
use crate::model::ContractVersion;
use crate::model::Integration;
use crate::model::LiquidationStatus;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanTransaction;
use crate::model::PsbtQueryParams;
use crate::model::User;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
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
use bitcoin::consensus::encode::FromHexError;
use bitcoin::Amount;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use miniscript::Descriptor;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use time::ext::NumericalDuration;
use time::format_description;
use time::OffsetDateTime;
use tracing::instrument;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/contracts",
            get(get_contracts).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id",
            get(get_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id",
            post(post_claim_tx).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts",
            post(post_contract_request).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id",
            delete(cancel_contract_request).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/repaid",
            put(put_repayment_provided).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id/claim",
            get(get_claim_collateral_psbt).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[instrument(skip_all, err(Debug))]
async fn post_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    AppJson(body): AppJson<ContractRequestSchema>,
) -> Result<AppJson<Contract>, Error> {
    let offer = db::loan_offers::loan_by_id(&data.db, &body.loan_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLoanOffer)?;

    let contract_id = Uuid::new_v4();
    let (borrower_loan_address, moon_invoice) = match body.integration {
        Integration::StableCoin => match body.borrower_loan_address {
            Some(borrower_loan_address) => (borrower_loan_address, None),
            None => return Err(Error::MissingBorrowerLoanAddress),
        },
        Integration::PayWithMoon => {
            if offer.loan_asset_chain != LoanAssetChain::Polygon
                || offer.loan_asset_type != LoanAssetType::Usdc
            {
                return Err(Error::InvalidMoonLoanRequest {
                    chain: offer.loan_asset_chain,
                    asset: offer.loan_asset_type,
                });
            }

            let cards = db::moon::get_borrower_cards(&data.db, user.id.as_str())
                .await
                .map_err(Error::Database)?;

            if !cards.is_empty() {
                return Err(Error::OneMoonCardAllowed);
            }

            let invoice = data
                .moon
                .generate_invoice(
                    body.loan_amount,
                    contract_id.to_string(),
                    offer.lender_id,
                    user.id.as_str(),
                )
                .await
                .map_err(Error::MoonInvoiceGeneration)?;

            (invoice.address.clone(), Some(invoice))
        }
    };

    let initial_price = get_bitmex_index_price(OffsetDateTime::now_utc())
        .await
        .map_err(Error::BitMexOpeningPrice)?;

    let min_ltv = offer.min_ltv;
    let initial_collateral = calculate_initial_collateral(body.loan_amount, min_ltv, initial_price)
        .map_err(Error::InitialCollateralCalculation)?;

    // TODO: Choose origination fee based on loan parameters. For now we only have one origination
    // fee anyway.
    let fee = data
        .config
        .origination_fee
        .first()
        .ok_or(Error::MissingOriginationFee)?;

    let origination_fee = calculate_origination_fee(body.loan_amount, fee.fee, initial_price)
        .map_err(Error::OriginationFeeCalculation)?;

    let contract = db::contracts::insert_contract_request(
        &data.db,
        contract_id,
        user.id.as_str(),
        &body.loan_id,
        min_ltv,
        initial_collateral.to_sat(),
        origination_fee.to_sat(),
        body.loan_amount,
        body.duration_months,
        body.borrower_btc_address,
        body.borrower_pk,
        borrower_loan_address.as_str(),
        body.integration,
        ContractVersion::TwoOfThree,
    )
    .await
    .map_err(Error::Database)?;

    let contract = map_to_api_contract(&data, contract).await?;

    if let Some(invoice) = moon_invoice {
        data.moon
            .persist_invoice(&invoice)
            .await
            .map_err(Error::Database)?;
    }

    let loan_url = format!(
        "{}/my-contracts/{}",
        data.config.lender_frontend_origin.to_owned(),
        contract.id
    );
    let email = Email::new(data.config.clone());

    // We don't want to fail this upwards because the contract request has been sent already.
    if let Err(e) = async {
        let lender = db::lenders::get_user_by_id(&data.db, &contract.lender.id)
            .await?
            .context("Failed to find lender")?;

        email
            .send_new_loan_request(lender, loan_url.as_str())
            .await
            .context("Failed to send loan-request email")?;

        db::contract_emails::mark_loan_request_as_sent(&data.db, &contract.id)
            .await
            .context("Failed to mark loan-request email as sent")?;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying lender about loan request: {e:#}");
    }

    Ok(AppJson(contract))
}

#[instrument(skip(data, user), err(Debug), ret)]
async fn cancel_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    if contract.status != ContractStatus::Requested {
        return Err(Error::InvalidCancelRequest {
            status: contract.status,
        });
    }

    db::contracts::mark_contract_as_cancelled(&data.db, contract_id.as_str(), user.id.as_str())
        .await
        .map_err(Error::Database)?;

    Ok(())
}

async fn get_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
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

async fn get_contract(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
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

#[instrument(skip(data, user), err(Debug))]
async fn put_repayment_provided(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    query_params: Query<PrincipalRepaidQueryParam>,
    Extension(user): Extension<User>,
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

    Ok(())
}

// This API is only needed for the version of the protocol _without_ DLCs. With DLCs, the borrower
// will be able to unilaterally reclaim the collateral after they learn the loan secret.
#[instrument(skip_all, fields(borrower_id = user.id, contract_id), err(Debug), ret)]
async fn get_claim_collateral_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
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

    let mut wallet = data.wallet.lock().await;

    let (psbt, collateral_descriptor) = wallet
        .create_claim_collateral_psbt(
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
        borrower_pk: contract.borrower_pk,
    };

    Ok(AppJson(res))
}

// We don't need the borrower to publish the claim TX through the hub, but it is convenient to be
// able to move the contract state forward. Eventually we could remove this and publish from the
// borrower client.
#[instrument(skip(data, _user), err(Debug), ret)]
async fn post_claim_tx(
    State(data): State<Arc<AppState>>,
    // TODO: Make sure that this API is called by the _right_ user.
    Extension(_user): Extension<User>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<ClaimTx>,
) -> Result<String, Error> {
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
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
    pub status: ContractStatus,
    pub borrower_pk: PublicKey,
    pub borrower_btc_address: String,
    pub borrower_loan_address: String,
    pub contract_address: Option<String>,
    pub loan_repayment_address: String,
    pub lender: LenderProfile,
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
    pub integration: Integration,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LenderProfile {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaimCollateralPsbt {
    pub psbt: String,
    pub collateral_descriptor: Descriptor<PublicKey>,
    pub borrower_pk: PublicKey,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaimTx {
    pub tx: String,
}

#[derive(Debug, Deserialize)]
pub struct PrincipalRepaidQueryParam {
    pub txid: String,
}

async fn get_bitmex_index_price(timestamp: OffsetDateTime) -> anyhow::Result<Decimal> {
    #[derive(serde::Deserialize, Debug)]
    #[serde(rename_all = "camelCase")]
    struct Index {
        #[serde(with = "time::serde::rfc3339")]
        #[serde(rename = "timestamp")]
        _timestamp: OffsetDateTime,
        last_price: f64,
        #[serde(rename = "reference")]
        _reference: String,
    }

    let time_format = format_description::parse("[year]-[month]-[day] [hour]:[minute]")?;

    // Ideally we get the price indicated by `timestamp`, but if it is not available we are happy to
    // take a price up to 1 minute in the past.
    let start_time = (timestamp - 1.minutes()).format(&time_format)?;
    let end_time = timestamp.format(&time_format)?;

    let mut url = reqwest::Url::parse("https://www.bitmex.com/api/v1/instrument/compositeIndex")?;
    url.query_pairs_mut()
        .append_pair("symbol", ".BXBT")
        .append_pair(
            "filter",
            // The `reference` is set to `BMI` to get the _composite_ index.

            &format!("{{\"symbol\": \".BXBT\", \"startTime\": \"{start_time}\", \"endTime\": \"{end_time}\", \"reference\": \"BMI\"}}"),
        )
        .append_pair("columns", "lastPrice,timestamp,reference")
        // Reversed to get the latest one.
        .append_pair("reverse", "true")
        // Only need one index.
        .append_pair("count", "1");

    let indices = reqwest::get(url).await?.json::<Vec<Index>>().await?;
    let index = &indices[0];

    let index_price = Decimal::try_from(index.last_price)?;

    Ok(index_price)
}

fn calculate_origination_fee(
    loan_amount: Decimal,
    fee: Decimal,
    initial_price: Decimal,
) -> anyhow::Result<Amount> {
    let fee_usd = loan_amount * fee;
    let fee_btc = fee_usd / initial_price;

    let fee_btc = fee_btc.round_dp(8);
    let fee_btc = fee_btc.to_f64().expect("to fit");

    Ok(Amount::from_btc(fee_btc).expect("to fit"))
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
        .ok_or(Error::MissingLoanOffer)?;

    let expiry = contract.expiry();

    let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLender)?;

    let transactions = db::transactions::get_all_for_contract_id(&data.db, contract.id.as_str())
        .await
        .map_err(Error::Database)?;

    let mut repaid_at = None;
    if contract.status == ContractStatus::Closed || contract.status == ContractStatus::Closing {
        repaid_at = Some(contract.updated_at);
    }

    let contract = Contract {
        id: contract.id,
        loan_amount: contract.loan_amount,
        duration_months: contract.duration_months,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        collateral_sats: contract.collateral_sats,
        interest_rate: offer.interest_rate,
        initial_ltv: contract.initial_ltv,
        loan_asset_type: offer.loan_asset_type,
        loan_asset_chain: offer.loan_asset_chain,
        status: contract.status,
        borrower_pk: contract.borrower_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        loan_repayment_address: offer.loan_repayment_address,
        lender: LenderProfile {
            id: contract.lender_id,
            name: lender.name,
        },
        created_at: contract.created_at,
        updated_at: contract.updated_at,
        repaid_at,
        expiry,
        liquidation_status: contract.liquidation_status,
        transactions,
        integration: contract.integration,
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
    MissingLoanOffer,
    /// Referenced lender does not exist.
    MissingLender,
    /// Failed to provide borrower loan address for stablecoin loan.
    MissingBorrowerLoanAddress,
    /// Moon only supports USDC on Polygon.
    InvalidMoonLoanRequest {
        chain: LoanAssetChain,
        asset: LoanAssetType,
    },
    /// Each user can only have one Moon card for now.
    OneMoonCardAllowed,
    /// Failed to generate Moon invoice.
    MoonInvoiceGeneration(anyhow::Error),
    /// Failed to get opening price from BitMEX.
    BitMexOpeningPrice(anyhow::Error),
    /// Failed to calculate initial collateral.
    InitialCollateralCalculation(anyhow::Error),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(anyhow::Error),
    /// Can't cancel a contract request with a [`ContractStatus`] different to
    /// [`ContractStatus::Requested`].
    InvalidCancelRequest { status: ContractStatus },
    /// Can't claim collateral if principal has not been repaid.
    PrincipalNotRepaid,
    /// Can't claim collateral without contract index.
    MissingContractIndex,
    /// Can't claim collateral without collateral address.
    MissingCollateralAddress,
    /// Can't claim collateral without lender Xpub.
    MissingLenderXpub,
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
            Error::MissingLoanOffer => {
                tracing::error!("Could not find referenced loan");

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
            Error::InvalidMoonLoanRequest { chain, asset } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Cannot create loan request for Moon card with asset {asset:?} \
                     on chain {chain:?}. Moon only supports USDC on Polygon"
                ),
            ),
            Error::OneMoonCardAllowed => (
                StatusCode::BAD_REQUEST,
                "Only one Moon card allowed per user".to_owned(),
            ),
            Error::MoonInvoiceGeneration(e) => {
                tracing::error!("Failed to generate Moon invoice: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::BitMexOpeningPrice(e) => {
                tracing::error!("Failed to get opening price from BitMEX: {e:#}");

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
            Error::MissingLenderXpub => {
                tracing::error!("Missing lender Xpub");

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
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
