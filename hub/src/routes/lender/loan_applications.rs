use crate::bitmex_index_price_rest::get_bitmex_index_price;
use crate::config::Config;
use crate::contract_requests::calculate_initial_collateral;
use crate::db;
use crate::model;
use crate::model::calculate_interest_usd;
use crate::model::FiatLoanDetailsWrapper;
use crate::model::Lender;
use crate::model::LoanApplicationStatus;
use crate::model::LoanAsset;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
use crate::take_loan_application;
use crate::take_loan_application::take_application;
use crate::utils::calculate_liquidation_price;
use anyhow::anyhow;
use anyhow::Context;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use bitcoin::bip32;
use bitcoin::PublicKey;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/loans/application",
            get(get_all_available_loan_applications),
        )
        .route("/api/loans/application/:id", get(get_loan_application))
        .route(
            "/api/loans/application/:id",
            post(post_take_loan_application),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_auth::auth,
        ))
        .with_state(app_state)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoanApplication {
    pub id: String,
    pub borrower: BorrowerProfile,
    #[serde(with = "rust_decimal::serde::float")]
    pub ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub liquidation_price: Decimal,
    pub duration_days: i32,
    pub loan_asset: LoanAsset,
    pub status: LoanApplicationStatus,
    pub borrower_pk: PublicKey,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BorrowerProfile {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[instrument(skip_all, err(Debug))]
pub async fn get_all_available_loan_applications(
    State(data): State<Arc<AppState>>,
) -> Result<AppJson<Vec<LoanApplication>>, Error> {
    let requests = db::loan_applications::load_all_available_loan_applications(&data.db)
        .await
        .map_err(Error::Database)?;

    let mut ret = vec![];
    for request in requests {
        let loan_application = map_to_api_loan_application(&data.db, &data.config, request).await?;

        ret.push(loan_application)
    }

    Ok(AppJson(ret))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_application(
    State(data): State<Arc<AppState>>,
    Path(loan_deal_id): Path<String>,
) -> Result<AppJson<LoanApplication>, Error> {
    let request = db::loan_applications::get_loan_by_id(&data.db, loan_deal_id.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::LoanApplicationNotFound(loan_deal_id))?;

    let loan_application = map_to_api_loan_application(&data.db, &data.config, request).await?;

    Ok(AppJson(loan_application))
}

async fn map_to_api_loan_application(
    db: &Pool<Postgres>,
    config: &Config,
    request: model::LoanApplication,
) -> Result<LoanApplication, Error> {
    let borrower = db::borrowers::get_user_by_id(db, &request.borrower_id)
        .await
        .map_err(Error::Database)?
        .context("No borrower found for loan application")
        .map_err(|_| Error::MissingBorrower)?;

    let price = get_bitmex_index_price(config, OffsetDateTime::now_utc())
        .await
        .map_err(Error::BitMexPrice)?;

    let initial_collateral = calculate_initial_collateral(
        request.loan_amount,
        request.interest_rate,
        request.duration_days as u32,
        request.ltv,
        price,
    )
    .map_err(Error::InitialCollateralCalculation)?;

    let interest_usd = calculate_interest_usd(
        request.loan_amount,
        request.interest_rate,
        request.duration_days as u32,
    );
    let outstanding_balance_usd = request.loan_amount + interest_usd;
    let liquidation_price = calculate_liquidation_price(
        outstanding_balance_usd,
        Decimal::from_u64(initial_collateral.to_sat()).expect("to fit into decimal"),
    )
    .ok_or(Error::LiquidationPriceCalculation)?;

    Ok(LoanApplication {
        id: request.loan_deal_id,
        borrower: BorrowerProfile {
            id: borrower.id,
            name: borrower.name,
        },
        ltv: request.ltv,
        interest_rate: request.interest_rate,
        loan_amount: request.loan_amount,
        duration_days: request.duration_days,
        loan_asset: request.loan_asset,
        status: request.status,
        liquidation_price,
        created_at: request.created_at,
        updated_at: request.updated_at,
        borrower_pk: request.borrower_pk,
    })
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TakeLoanApplicationSchema {
    pub lender_pk: PublicKey,
    pub lender_derivation_path: bip32::DerivationPath,
    pub loan_repayment_address: String,
    pub lender_npub: String,
    pub fiat_loan_details: Option<FiatLoanDetailsWrapper>,
}

#[instrument(skip_all, fields(lender_id = user.id, loan_deal_id, body), err(Debug), ret)]
pub async fn post_take_loan_application(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(loan_deal_id): Path<String>,
    Json(body): Json<TakeLoanApplicationSchema>,
) -> Result<AppJson<String>, Error> {
    let wallet = data.wallet.clone();
    let contract_id = take_application(
        &data.db,
        wallet,
        &data.mempool,
        &data.config,
        user.id.as_str(),
        data.notifications.clone(),
        body,
        loan_deal_id.as_str(),
    )
    .await
    .map_err(Error::from)?;
    Ok(AppJson(contract_id))
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

/// All the errors related to the `contracts` REST API.
#[derive(Debug)]
enum Error {
    /// Failed to interact with the database.
    Database(anyhow::Error),
    /// Referenced borrower does not exist.
    MissingBorrower,
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to get price.
    BitMexPrice(anyhow::Error),
    /// Failed to calculate initial collateral
    InitialCollateralCalculation(anyhow::Error),
    /// Failed to generate contract address.
    ContractAddress(anyhow::Error),
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(anyhow::Error),
    /// Invalid discount rate.
    InvalidDiscountRate(anyhow::Error),
    /// Failed tracking contract address.
    TrackContract(anyhow::Error),
    LoanApplicationNotFound(String),
    /// Failed to calculate liquidation price.
    LiquidationPriceCalculation,
    /// The lender didn't provide fiat loan details.
    MissingFiatLoanDetails,
    /// The loan application had a loan duration of zero days.
    ZeroLoanDuration,
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
            Error::Database(e) => {
                // If we configure `tracing` properly, we don't need to add extra context here!
                tracing::error!("Database error: {e:#}");

                // Don't expose any details about the error to the client.
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingBorrower => {
                tracing::error!("Could not find referenced lender");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingOriginationFee => {
                tracing::error!("Origination fee was not configured");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::BitMexPrice(e) => {
                tracing::error!("Could not fetch bitmex price {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::InitialCollateralCalculation(e) => {
                tracing::error!("Failed calculating collateral amount {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::ContractAddress(e) => {
                tracing::error!("Could not create contract address {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::OriginationFeeCalculation(e) => {
                tracing::error!("Could not calculate origination fee {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::InvalidDiscountRate(e) => {
                tracing::error!("Discount rate was invalid {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::TrackContract(e) => {
                tracing::error!("Failed tracking contract address {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::LoanApplicationNotFound(id) => {
                tracing::error!("{}", format!("Loan application not found {}", id));
                (
                    StatusCode::BAD_REQUEST,
                    "LoanApplication not found".to_owned(),
                )
            }
            Error::LiquidationPriceCalculation => {
                tracing::error!("{}", "Failed calculating liquidation price".to_string());
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::MissingFiatLoanDetails => (
                StatusCode::BAD_REQUEST,
                "LoanApplication not found".to_owned(),
            ),
            Error::ZeroLoanDuration => {
                tracing::error!("Cannot take zero-duration loan application");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

impl From<take_loan_application::Error> for Error {
    fn from(value: take_loan_application::Error) -> Self {
        match value {
            take_loan_application::Error::Database(e) => Error::Database(e),
            take_loan_application::Error::MissingOriginationFee => Error::MissingOriginationFee,
            take_loan_application::Error::BitMexPrice(e) => Error::BitMexPrice(e),
            take_loan_application::Error::InitialCollateralCalculation(e) => {
                Error::InitialCollateralCalculation(e)
            }
            take_loan_application::Error::ContractAddress(e) => Error::ContractAddress(e),
            take_loan_application::Error::OriginationFeeCalculation(e) => {
                Error::OriginationFeeCalculation(e)
            }
            take_loan_application::Error::InvalidDiscountRate(e) => {
                Error::InvalidDiscountRate(anyhow!(e))
            }
            take_loan_application::Error::TrackContract(e) => Error::TrackContract(e),
            take_loan_application::Error::LoanApplicationNotFound(id) => {
                Error::LoanApplicationNotFound(id)
            }
            take_loan_application::Error::MissingFiatLoanDetails => Error::MissingFiatLoanDetails,
            take_loan_application::Error::ZeroLoanDuration => Error::ZeroLoanDuration,
        }
    }
}
