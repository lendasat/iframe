use crate::db;
use crate::model::lender_feature_flags;
use crate::model::CreateLoanOfferSchema;
use crate::model::ExtensionPolicy;
use crate::model::Lender;
use crate::model::LoanAsset;
use crate::model::LoanOfferStatus;
use crate::model::LoanPayout;
use crate::model::OriginationFee;
use crate::model::RepaymentPlan;
use crate::routes::lender::auth::jwt_or_api_auth::auth;
use crate::routes::lender::LOAN_OFFERS_TAG;
use crate::routes::AppState;
use crate::user_stats;
use crate::user_stats::LenderStats;
use anyhow::anyhow;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;
use url::Url;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(create_loan_offer))
        .routes(routes!(get_my_loan_offers))
        .routes(routes!(get_loan_offer_by_lender_and_offer_id))
        .routes(routes!(delete_loan_offer_by_lender_and_offer_id))
        .routes(routes!(get_loan_offers))
        .routes(routes!(get_latest_stats))
        .route_layer(middleware::from_fn_with_state(app_state.clone(), auth))
        .with_state(app_state)
}

/// Create a new loan offer.
#[utoipa::path(
    post,
    request_body = CreateLoanOfferSchema,
    path = "/create",
    tag = LOAN_OFFERS_TAG,
    responses(
        (
            status = 200,
            description = "Loan offer created successfully"
        ),
        (
            status = 400,
            description = "Invalid loan offer parameters"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip_all, err(Debug))]
async fn create_loan_offer(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    body: AppJson<CreateLoanOfferSchema>,
) -> Result<AppJson<LoanOffer>, Error> {
    if body.0.min_ltv > dec!(1.0) || body.0.min_ltv < Decimal::zero() {
        return Err(Error::InvalidLtv {
            ltv: body.0.min_ltv,
        });
    }

    if body.0.interest_rate > dec!(1.0) || body.0.interest_rate < Decimal::zero() {
        return Err(Error::InvalidInterestRate {
            rate: body.0.interest_rate,
        });
    }

    let features = db::lender_features::load_lender_features(&data.db, user.id.clone())
        .await
        .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

    if features.iter().any(|feature| {
        body.0.auto_accept
            && feature.id == lender_feature_flags::AUTO_APPROVE_FEATURE_FLAG_ID
            && !feature.is_enabled
    }) {
        return Err(Error::AutoApproveNotEnabled);
    }

    if features.iter().any(|feature| {
        body.0.kyc_link.is_some()
            && feature.id == lender_feature_flags::KYC_OFFERS_FEATURE_FLAG_ID
            && !feature.is_enabled
    }) {
        return Err(Error::KycOffersNotEnabled);
    }

    let offer = db::loan_offers::insert_loan_offer(&data.db, body.0, user.id.as_str())
        .await
        .map_err(Error::database)?;

    let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    let origination_fee = data.config.origination_fee.clone();

    let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
        .await
        .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

    if matches!(offer.loan_payout, LoanPayout::Indirect) && !offer.auto_accept {
        return Err(Error::IndirectPayoutRequiresAutoAccept);
    }

    let (extension_max_duration_days, extension_interest_rate) = match offer.extension_policy {
        ExtensionPolicy::DoNotExtend => (0, None),
        ExtensionPolicy::AfterHalfway {
            interest_rate,
            max_duration_days,
        } => (max_duration_days, Some(interest_rate)),
    };

    let offer_url = data
        .config
        .borrower_frontend_origin
        .join(format!("/requests?offer={}", offer.loan_deal_id).as_str())
        .map_err(|e| Error::InvalidUrl(e.to_string()))?;
    data.notifications
        .send_new_loan_offer_available(
            offer_url,
            offer.loan_amount_min,
            offer.loan_amount_max,
            offer.loan_asset,
            offer.interest_rate,
            offer.duration_days_min,
            offer.duration_days_max,
        )
        .await;

    let offer = LoanOffer {
        id: offer.loan_deal_id,
        lender: lender_stats,
        name: offer.name,
        min_ltv: offer.min_ltv,
        interest_rate: offer.interest_rate,
        loan_amount_min: offer.loan_amount_min,
        loan_amount_max: offer.loan_amount_max,
        loan_amount_reserve: offer.loan_amount_reserve,
        loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
        duration_days_min: offer.duration_days_min,
        duration_days_max: offer.duration_days_max,
        loan_asset: offer.loan_asset,
        loan_payout: offer.loan_payout,
        status: offer.status,
        auto_accept: offer.auto_accept,
        loan_repayment_address: offer.loan_repayment_address,
        origination_fee,
        kyc_link: offer.kyc_link,
        extension_max_duration_days,
        extension_interest_rate,
        repayment_plan: offer.repayment_plan,
        created_at: offer.created_at,
        updated_at: offer.updated_at,
    };

    Ok(AppJson(offer))
}

/// Get all loan offers for this lender.
#[utoipa::path(
    get,
    path = "/own",
    tag = LOAN_OFFERS_TAG,
    responses(
        (
            status = 200,
            description = "List of loan offers for this lender"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip_all, err(Debug))]
async fn get_my_loan_offers(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> Result<AppJson<Vec<LoanOffer>>, Error> {
    // TODO: don't return the db object here but map it to a different one so that we can enhance it
    // with more data.
    let loans = db::loan_offers::load_all_loan_offers_by_lender(&data.db, user.id.as_str())
        .await
        .map_err(Error::database)?;

    let lender = db::lenders::get_user_by_id(&data.db, &user.id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
        .await
        .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

    let origination_fee = data.config.origination_fee.clone();

    let mut ret = vec![];
    for offer in loans {
        let (extension_max_duration_days, extension_interest_rate) = match offer.extension_policy {
            ExtensionPolicy::DoNotExtend => (0, None),
            ExtensionPolicy::AfterHalfway {
                interest_rate,
                max_duration_days,
            } => (max_duration_days, Some(interest_rate)),
        };

        let offer = LoanOffer {
            id: offer.loan_deal_id,
            lender: lender_stats.clone(),
            name: offer.name,
            min_ltv: offer.min_ltv,
            interest_rate: offer.interest_rate,
            loan_amount_min: offer.loan_amount_min,
            loan_amount_max: offer.loan_amount_max,
            duration_days_min: offer.duration_days_min,
            duration_days_max: offer.duration_days_max,
            loan_amount_reserve: offer.loan_amount_reserve,
            loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
            loan_asset: offer.loan_asset,
            loan_payout: offer.loan_payout,
            status: offer.status,
            auto_accept: offer.auto_accept,
            loan_repayment_address: offer.loan_repayment_address,
            origination_fee: origination_fee.clone(),
            kyc_link: offer.kyc_link,
            extension_max_duration_days,
            extension_interest_rate,
            repayment_plan: offer.repayment_plan,
            created_at: offer.created_at,
            updated_at: offer.updated_at,
        };
        ret.push(offer)
    }

    Ok(AppJson(ret))
}

/// Get a specific loan offer by ID.
#[utoipa::path(
    get,
    path = "/{offer_id}",
    tag = LOAN_OFFERS_TAG,
    params(
        ("offer_id" = String, Path, description = "Loan offer ID")
    ),
    responses(
        (
            status = 200,
            description = "Loan offer details"
        ),
        (
            status = 404,
            description = "Loan offer not found"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip_all, err(Debug))]
async fn get_loan_offer_by_lender_and_offer_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(offer_id): Path<String>,
) -> Result<AppJson<LoanOffer>, Error> {
    let offer = db::loan_offers::get_loan_offer_by_lender_and_offer_id(
        &data.db,
        user.id.as_str(),
        offer_id.as_str(),
    )
    .await
    .map_err(Error::database)?;

    let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    let origination_fee = data.config.origination_fee.clone();

    let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
        .await
        .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

    let (extension_max_duration_days, extension_interest_rate) = match offer.extension_policy {
        ExtensionPolicy::DoNotExtend => (0, None),
        ExtensionPolicy::AfterHalfway {
            interest_rate,
            max_duration_days,
        } => (max_duration_days, Some(interest_rate)),
    };

    let loan = LoanOffer {
        id: offer.loan_deal_id,
        lender: lender_stats,
        name: offer.name,
        min_ltv: offer.min_ltv,
        interest_rate: offer.interest_rate,
        loan_amount_min: offer.loan_amount_min,
        loan_amount_max: offer.loan_amount_max,
        loan_amount_reserve: offer.loan_amount_reserve,
        loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
        duration_days_min: offer.duration_days_min,
        duration_days_max: offer.duration_days_max,
        loan_asset: offer.loan_asset,
        loan_payout: offer.loan_payout,
        status: offer.status,
        auto_accept: offer.auto_accept,
        loan_repayment_address: offer.loan_repayment_address,
        origination_fee,
        kyc_link: offer.kyc_link,
        extension_max_duration_days,
        extension_interest_rate,
        repayment_plan: offer.repayment_plan,
        created_at: offer.created_at,
        updated_at: offer.updated_at,
    };

    Ok(AppJson(loan))
}

/// Get all available loan offers from all lenders.
#[utoipa::path(
    get,
    path = "/",
    tag = LOAN_OFFERS_TAG,
    responses(
        (
            status = 200,
            description = "List of all available loan offers"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip_all, err(Debug))]
async fn get_loan_offers(
    State(data): State<Arc<AppState>>,
) -> Result<AppJson<Vec<LoanOffer>>, Error> {
    let loans = db::loan_offers::load_all_available_loan_offers(&data.db)
        .await
        .map_err(Error::database)?;

    let mut ret = vec![];
    for offer in loans {
        let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
            .await
            .map_err(Error::database)?
            .ok_or(Error::MissingLender)?;

        let origination_fee = data.config.origination_fee.clone();

        let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
            .await
            .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

        let (extension_max_duration_days, extension_interest_rate) = match offer.extension_policy {
            ExtensionPolicy::DoNotExtend => (0, None),
            ExtensionPolicy::AfterHalfway {
                interest_rate,
                max_duration_days,
            } => (max_duration_days, Some(interest_rate)),
        };

        ret.push(LoanOffer {
            id: offer.loan_deal_id,
            lender: lender_stats,
            name: offer.name,
            min_ltv: offer.min_ltv,
            interest_rate: offer.interest_rate,
            loan_amount_min: offer.loan_amount_min,
            loan_amount_max: offer.loan_amount_max,
            loan_amount_reserve: offer.loan_amount_reserve,
            loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
            duration_days_min: offer.duration_days_min,
            duration_days_max: offer.duration_days_max,
            loan_asset: offer.loan_asset,
            loan_payout: offer.loan_payout,
            status: offer.status,
            auto_accept: offer.auto_accept,
            loan_repayment_address: offer.loan_repayment_address,
            origination_fee,
            kyc_link: offer.kyc_link,
            extension_max_duration_days,
            extension_interest_rate,
            repayment_plan: offer.repayment_plan,
            created_at: offer.created_at,
            updated_at: offer.updated_at,
        })
    }

    Ok(AppJson(ret))
}

/// Delete own loan offer.
#[utoipa::path(
    delete,
    path = "/{offer_id}",
    tag = LOAN_OFFERS_TAG,
    params(
        ("offer_id" = String, Path, description = "Loan offer ID to delete")
    ),
    responses(
        (
            status = 200,
            description = "Loan offer deleted successfully"
        ),
        (
            status = 404,
            description = "Loan offer not found"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip_all, err(Debug))]
async fn delete_loan_offer_by_lender_and_offer_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(offer_id): Path<String>,
) -> Result<(), Error> {
    db::loan_offers::mark_as_deleted_by_lender_and_offer_id(
        &data.db,
        user.id.as_str(),
        offer_id.as_str(),
    )
    .await
    .map_err(Error::database)?;

    Ok(())
}

/// Get latest statistics for all loan offers and contracts.
#[utoipa::path(
    get,
    path = "/stats",
    tag = LOAN_OFFERS_TAG,
    responses(
        (
            status = 200,
            description = "Latest loan offer and contract statistics"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip_all, err(Debug))]
async fn get_latest_stats(State(data): State<Arc<AppState>>) -> Result<AppJson<Stats>, Error> {
    let stats = db::loan_offers::calculate_loan_offer_stats(&data.db)
        .await
        .map_err(Error::database)?;

    let loan_offer_stats = LoanOfferStats::from(stats);

    let latest_contract_stats = db::contracts::load_latest_contract_stats(&data.db, 10)
        .await
        .map_err(Error::database)?;

    let contract_stats = latest_contract_stats
        .into_iter()
        .map(ContractStats::from)
        .collect::<Vec<_>>();

    Ok(AppJson(Stats {
        contract_stats,
        loan_offer_stats,
    }))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LoanOffer {
    id: String,
    lender: LenderStats,
    name: String,
    #[serde(with = "rust_decimal::serde::float")]
    min_ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount_min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount_max: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount_reserve: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount_reserve_remaining: Decimal,
    auto_accept: bool,
    duration_days_min: i32,
    duration_days_max: i32,
    loan_asset: LoanAsset,
    loan_payout: LoanPayout,
    status: LoanOfferStatus,
    loan_repayment_address: String,
    origination_fee: Vec<OriginationFee>,
    kyc_link: Option<Url>,
    extension_max_duration_days: u64,
    #[serde(with = "rust_decimal::serde::float_option")]
    extension_interest_rate: Option<Decimal>,
    repayment_plan: RepaymentPlan,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    updated_at: OffsetDateTime,
}

#[derive(Serialize, Debug)]
struct Stats {
    contract_stats: Vec<ContractStats>,
    loan_offer_stats: LoanOfferStats,
}

#[derive(Serialize, Debug)]
struct ContractStats {
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount: Decimal,
    duration_days: i32,
    #[serde(with = "rust_decimal::serde::float")]
    interest_rate: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

#[derive(Serialize, Debug)]
struct LoanOfferStats {
    #[serde(with = "rust_decimal::serde::float")]
    avg: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    max: Decimal,
}

impl From<db::loan_offers::InterestRateStats> for LoanOfferStats {
    fn from(value: db::loan_offers::InterestRateStats) -> Self {
        Self {
            avg: value.avg,
            min: value.min,
            max: value.max,
        }
    }
}

impl From<db::contracts::ContractStats> for ContractStats {
    fn from(value: db::contracts::ContractStats) -> Self {
        Self {
            loan_amount: value.loan_amount,
            duration_days: value.duration_days,
            interest_rate: value.interest_rate,
            created_at: value.created_at,
        }
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

// Error fields are allowed to be dead code because they are actually used when printed in logs.
/// All the errors related to the `loan_offers` REST API.
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Invalid LTV value.
    InvalidLtv { ltv: Decimal },
    /// Invalid interest rate value.
    InvalidInterestRate { rate: Decimal },
    /// Referenced lender does not exist.
    MissingLender,
    /// Auto approve feature is not enabled.
    AutoApproveNotEnabled,
    /// KYC offers feature is not enabled.
    KycOffersNotEnabled,
    /// Indirect payouts require auto-accept to be enabled.
    IndirectPayoutRequiresAutoAccept,
    /// Invalid url, e.g. couldn't parse an url
    InvalidUrl(#[allow(dead_code)] String),
}

impl Error {
    fn database(e: anyhow::Error) -> Self {
        Self::Database(format!("{e:#}"))
    }
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

/// Tell `axum` how [`Error`] should be converted into a response.
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
            Error::Database(_) | Error::MissingLender => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::AutoApproveNotEnabled => (
                StatusCode::UNAUTHORIZED,
                "Auto approve feature is not enabled".to_owned(),
            ),
            Error::KycOffersNotEnabled => (
                StatusCode::UNAUTHORIZED,
                "KYC offers feature is not enabled".to_owned(),
            ),
            Error::IndirectPayoutRequiresAutoAccept => (
                StatusCode::BAD_REQUEST,
                "Indirect payouts require auto-accept to be enabled".to_owned(),
            ),
            Error::InvalidLtv { ltv } => (
                StatusCode::BAD_REQUEST,
                format!("LTV needs to be between 0.00 and 1.00 but was {ltv}"),
            ),
            Error::InvalidInterestRate { rate } => (
                StatusCode::BAD_REQUEST,
                format!("Interest rate needs to be between 0.00 and 1.00 but was {rate}",),
            ),
            Error::InvalidUrl(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
