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
use crate::model::Npub;
use crate::routes::lender::auth::jwt_or_api_auth;
use crate::routes::lender::LOAN_APPLICATIONS_TAG;
use crate::routes::AppState;
use crate::take_loan_application;
use crate::take_loan_application::take_application;
use crate::user_stats;
use crate::user_stats::get_borrower_stats;
use crate::user_stats::BorrowerStats;
use crate::utils::calculate_liquidation_price;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
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
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_all_available_loan_applications))
        .routes(routes!(get_loan_application))
        .routes(routes!(post_take_loan_application))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .with_state(app_state.clone())
}

/// Get all available loan applications.
#[utoipa::path(
    get,
    path = "/",
    tag = LOAN_APPLICATIONS_TAG,
    responses(
        (
            status = 200,
            description = "List of available loan applications",
            body = [LoanApplication]
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip_all, err(Debug))]
async fn get_all_available_loan_applications(
    State(data): State<Arc<AppState>>,
) -> Result<AppJson<Vec<LoanApplication>>, Error> {
    let requests = db::loan_applications::load_all_available_loan_applications(&data.db)
        .await
        .map_err(Error::database)?;

    let mut ret = vec![];
    for request in requests {
        let loan_application = map_to_api_loan_application(&data.db, &data.config, request).await?;

        ret.push(loan_application)
    }

    Ok(AppJson(ret))
}

/// Get a specific loan application by ID.
#[utoipa::path(
    get,
    path = "/{loan_deal_id}",
    tag = LOAN_APPLICATIONS_TAG,
    params(
        ("loan_deal_id" = String, Path, description = "Loan application ID")
    ),
    responses(
        (
            status = 200,
            description = "Loan application details",
            body = LoanApplication
        ),
        (
            status = 404,
            description = "Loan application not found"
        )
    ),
)]
#[instrument(skip_all, err(Debug))]
async fn get_loan_application(
    State(data): State<Arc<AppState>>,
    Path(loan_deal_id): Path<String>,
) -> Result<AppJson<LoanApplication>, Error> {
    let request = db::loan_applications::get_loan_by_id(&data.db, loan_deal_id.as_str())
        .await
        .map_err(Error::database)?
        .ok_or(Error::LoanApplicationNotFound(loan_deal_id))?;

    let loan_application = map_to_api_loan_application(&data.db, &data.config, request).await?;

    Ok(AppJson(loan_application))
}

/// Take a loan application.
#[utoipa::path(
    post,
    path = "/{loan_deal_id}",
    tag = LOAN_APPLICATIONS_TAG,
    request_body = TakeLoanApplicationSchema,
    params(
        ("loan_deal_id" = String, Path, description = "Loan application ID to take")
    ),
    responses(
        (
            status = 200,
            description = "Loan application taken successfully",
            body = String
        ),
        (
            status = 404,
            description = "Loan application not found"
        )
    ),
)]
#[instrument(skip_all, fields(lender_id = user.id, loan_deal_id, body), err(Debug), ret)]
async fn post_take_loan_application(
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

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
struct LoanApplication {
    id: String,
    borrower: BorrowerStats,
    #[serde(with = "rust_decimal::serde::float")]
    ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    liquidation_price: Decimal,
    duration_days: i32,
    loan_asset: LoanAsset,
    status: LoanApplicationStatus,
    #[schema(value_type = String)]
    borrower_pk: PublicKey,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct TakeLoanApplicationSchema {
    #[schema(value_type = String)]
    pub lender_pk: PublicKey,
    #[schema(value_type = String)]
    pub lender_derivation_path: bip32::DerivationPath,
    pub loan_repayment_address: String,
    pub lender_npub: Npub,
    pub fiat_loan_details: Option<FiatLoanDetailsWrapper>,
}

async fn map_to_api_loan_application(
    db: &Pool<Postgres>,
    config: &Config,
    request: model::LoanApplication,
) -> Result<LoanApplication, Error> {
    let borrower = get_borrower_stats(db, request.borrower_id.as_str()).await?;

    let price = get_bitmex_index_price(config, OffsetDateTime::now_utc(), request.loan_asset)
        .await
        .map_err(Error::bitmex_price)?;

    // TODO: Choose origination fee based on loan parameters. For now we only have one origination
    // fee anyway.
    let origination_fee = config
        .origination_fee
        .first()
        .ok_or(Error::MissingOriginationFee)?;

    // If the user has a discount code, we reduce the origination fee for them.
    let origination_fee_rate =
        discounted_origination_fee::calculate_discounted_origination_fee_rate(
            db,
            origination_fee.fee,
            &request.borrower_id,
        )
        .await
        .map_err(Error::from)?;

    let origination_fee_amount =
        calculate_origination_fee(request.loan_amount, origination_fee_rate, price)
            .map_err(Error::origination_fee_calculation)?;

    let initial_collateral = calculate_initial_collateral(
        request.loan_amount,
        request.interest_rate,
        request.duration_days as u32,
        request.ltv,
        price,
        origination_fee_amount,
    )
    .map_err(Error::initial_collateral_calculation)?;

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
        borrower,
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
    Database(#[allow(dead_code)] String),
    /// Referenced borrower does not exist.
    MissingBorrower,
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to get price.
    BitMexPrice(#[allow(dead_code)] String),
    /// Failed to calculate initial collateral
    InitialCollateralCalculation(#[allow(dead_code)] String),
    /// Failed to generate contract address.
    ContractAddress(#[allow(dead_code)] String),
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(#[allow(dead_code)] String),
    /// Invalid discount rate.
    InvalidDiscountRate(#[allow(dead_code)] String),
    /// Failed tracking contract address.
    TrackContract(#[allow(dead_code)] String),
    LoanApplicationNotFound(#[allow(dead_code)] String),
    /// Failed to calculate liquidation price.
    LiquidationPriceCalculation,
    /// The lender didn't provide fiat loan details.
    MissingFiatLoanDetails,
    /// The loan application had a loan duration of zero days.
    ZeroLoanDuration,
}

impl Error {
    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
    }

    fn bitmex_price(e: impl std::fmt::Display) -> Self {
        Self::BitMexPrice(format!("{e:#}"))
    }

    fn initial_collateral_calculation(e: impl std::fmt::Display) -> Self {
        Self::InitialCollateralCalculation(format!("{e:#}"))
    }

    fn contract_address(e: impl std::fmt::Display) -> Self {
        Self::ContractAddress(format!("{e:#}"))
    }

    fn origination_fee_calculation(e: impl std::fmt::Display) -> Self {
        Self::OriginationFeeCalculation(format!("{e:#}"))
    }

    fn invalid_discount_rate(e: impl std::fmt::Display) -> Self {
        Self::InvalidDiscountRate(format!("{e:#}"))
    }

    fn track_contract(e: impl std::fmt::Display) -> Self {
        Self::TrackContract(format!("{e:#}"))
    }
}

/// Tell `axum` how [`AppError`] should be converted into a response.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::Database(_)
            | Error::MissingBorrower
            | Error::MissingOriginationFee
            | Error::BitMexPrice(_)
            | Error::InitialCollateralCalculation(_)
            | Error::ContractAddress(_)
            | Error::OriginationFeeCalculation(_)
            | Error::InvalidDiscountRate(_)
            | Error::TrackContract(_)
            | Error::LiquidationPriceCalculation
            | Error::ZeroLoanDuration => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::LoanApplicationNotFound(_) => (
                StatusCode::BAD_REQUEST,
                "Loan application not found".to_owned(),
            ),

            Error::MissingFiatLoanDetails => (
                StatusCode::BAD_REQUEST,
                "Fiat loan details not found".to_owned(),
            ),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

impl From<take_loan_application::Error> for Error {
    fn from(value: take_loan_application::Error) -> Self {
        match value {
            take_loan_application::Error::Database(e) => Error::database(e),
            take_loan_application::Error::MissingOriginationFee => Error::MissingOriginationFee,
            take_loan_application::Error::BitMexPrice(e) => Error::bitmex_price(e),
            take_loan_application::Error::InitialCollateralCalculation(e) => {
                Error::initial_collateral_calculation(e)
            }
            take_loan_application::Error::ContractAddress(e) => Error::contract_address(e),
            take_loan_application::Error::OriginationFeeCalculation(e) => {
                Error::origination_fee_calculation(e)
            }
            take_loan_application::Error::InvalidDiscountRate(e) => Error::invalid_discount_rate(e),
            take_loan_application::Error::TrackContract(e) => Error::track_contract(e),
            take_loan_application::Error::LoanApplicationNotFound(id) => {
                Error::LoanApplicationNotFound(id)
            }
            take_loan_application::Error::MissingFiatLoanDetails => Error::MissingFiatLoanDetails,
            take_loan_application::Error::ZeroLoanDuration => Error::ZeroLoanDuration,
            take_loan_application::Error::MissingBorrower => Error::MissingBorrower,
        }
    }
}
impl From<user_stats::Error> for Error {
    fn from(value: user_stats::Error) -> Self {
        match value {
            user_stats::Error::Database(e) => Error::database(e),
        }
    }
}

impl From<discounted_origination_fee::Error> for Error {
    fn from(value: discounted_origination_fee::Error) -> Self {
        match value {
            discounted_origination_fee::Error::InvalidDiscountRate { fee } => {
                Error::invalid_discount_rate(format!("Invalid Discount Rate {fee:?}"))
            }
            discounted_origination_fee::Error::Database(e) => Error::database(e),
        }
    }
}
