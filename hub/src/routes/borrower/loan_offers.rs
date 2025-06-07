use crate::db;
use crate::model::LoanAsset;
use crate::model::LoanOfferStatus;
use crate::model::LoanPayout;
use crate::model::OriginationFee;
use crate::model::RepaymentPlan;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::LOAN_OFFERS_TAG;
use crate::routes::AppState;
use crate::user_stats;
use crate::user_stats::LenderStats;
use anyhow::anyhow;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Json;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use url::Url;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_all_available_loan_offers))
        .routes(routes!(get_loan_offer))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .routes(routes!(get_available_loan_offers_by_lender))
        .with_state(app_state)
}

/// Get all available loan offers.
#[utoipa::path(
get,
path = "/",
tag = LOAN_OFFERS_TAG,
params(
    ("loan_type" = Option<QueryParamLoanType>, Query, description = "Filter by loan type: Direct, Indirect, or All. Defaults to Direct if not provided.")
),
responses(
    (
    status = 200,
    description = "A list of available offers",
    body = [LoanOffer]
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn get_all_available_loan_offers(
    State(data): State<Arc<AppState>>,
    Query(query): Query<LoanOffersQuery>,
) -> Result<AppJson<Vec<LoanOffer>>, Error> {
    let loans = db::loan_offers::load_all_available_loan_offers(&data.db)
        .await
        .map_err(Error::database)?;

    let mut ret = vec![];

    let filter_by = query.loan_type.unwrap_or(QueryParamLoanType::Direct);

    for loan_offer in loans {
        match filter_by {
            QueryParamLoanType::Direct => {
                if loan_offer.loan_payout != LoanPayout::Direct {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::Indirect => {
                if loan_offer.loan_payout != LoanPayout::Indirect {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::All => {
                // we take all offers
            }
        }

        let lender = db::lenders::get_user_by_id(&data.db, &loan_offer.lender_id)
            .await
            .map_err(Error::database)?
            .ok_or(Error::MissingLender)?;

        // TODO: filter available origination fees once we have more than one
        let origination_fee = data.config.origination_fee.clone();

        let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
            .await
            .map_err(|e| Error::database(anyhow!("{e:?}")))?;

        ret.push(LoanOffer {
            id: loan_offer.loan_deal_id,
            lender: lender_stats,
            name: loan_offer.name,
            min_ltv: loan_offer.min_ltv,
            interest_rate: loan_offer.interest_rate,
            loan_amount_min: loan_offer.loan_amount_min,
            loan_amount_max: loan_offer.loan_amount_max,
            duration_days_min: loan_offer.duration_days_min,
            duration_days_max: loan_offer.duration_days_max,
            loan_asset: loan_offer.loan_asset,
            loan_payout: loan_offer.loan_payout,
            status: loan_offer.status,
            loan_repayment_address: loan_offer.loan_repayment_address,
            origination_fee,
            kyc_link: loan_offer.kyc_link,
            lender_pk: loan_offer.lender_pk,
            repayment_plan: loan_offer.repayment_plan,
        })
    }

    Ok(AppJson(ret))
}

/// Get all the loan offers of a given lender.
#[utoipa::path(
get,
path = "/by-lender/{id}",
params(
    ("loan_type" = Option<QueryParamLoanType>, Query, description = "Filter by loan type: Direct, Indirect, or All. Defaults to Direct if not provided."),
    ("id" = String, Path, description = "Lender ID")
),
tag = LOAN_OFFERS_TAG,
responses(
    (
    status = 200,
    description = "A list of loan offers created by the given lender",
    body = [LoanOffer]
    )
),
)
]
#[instrument(skip_all, err(Debug))]
async fn get_available_loan_offers_by_lender(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
    Query(query): Query<LoanOffersQuery>,
) -> Result<AppJson<Vec<LoanOffer>>, Error> {
    let available_loans =
        db::loan_offers::load_available_loan_offers_by_lender(&data.db, lender_id.as_str())
            .await
            .map_err(Error::database)?;

    let mut ret = vec![];

    let lender = db::lenders::get_user_by_id(&data.db, &lender_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    let filter_by = query.loan_type.unwrap_or(QueryParamLoanType::Direct);

    for loan_offer in available_loans {
        match filter_by {
            QueryParamLoanType::Direct => {
                if loan_offer.loan_payout != LoanPayout::Direct {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::Indirect => {
                if loan_offer.loan_payout != LoanPayout::Indirect {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::All => {
                // we take all offers
            }
        }
        // TODO: filter available origination fees once we have more than one
        let origination_fee = data.config.origination_fee.clone();

        let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
            .await
            .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

        ret.push(LoanOffer {
            id: loan_offer.loan_deal_id,
            lender: lender_stats,
            name: loan_offer.name,
            min_ltv: loan_offer.min_ltv,
            interest_rate: loan_offer.interest_rate,
            loan_amount_min: loan_offer.loan_amount_min,
            loan_amount_max: loan_offer.loan_amount_max,
            duration_days_min: loan_offer.duration_days_min,
            duration_days_max: loan_offer.duration_days_max,
            loan_asset: loan_offer.loan_asset,
            loan_payout: loan_offer.loan_payout,
            status: loan_offer.status,
            loan_repayment_address: loan_offer.loan_repayment_address,
            origination_fee,
            kyc_link: loan_offer.kyc_link,
            lender_pk: loan_offer.lender_pk,
            repayment_plan: loan_offer.repayment_plan,
        })
    }

    Ok(AppJson(ret))
}

/// Get a specific loan offer.
#[utoipa::path(
get,
path = "/{id}",
params(
    (
    "id" = String, Path, description = "Loan offer ID"
    )
),
tag = LOAN_OFFERS_TAG,
responses(
    (
    status = 200,
    description = "A loan offer",
    body = LoanOffer
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn get_loan_offer(
    State(data): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<AppJson<LoanOffer>, Error> {
    let loan = db::loan_offers::loan_by_id(&data.db, id.as_str())
        .await
        .map_err(Error::database)?;

    let loan_offer = loan.ok_or(Error::MissingLoanOffer)?;
    let lender = db::lenders::get_user_by_id(&data.db, &loan_offer.lender_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    // TODO: filter available origination fees once we have more than one
    let origination_fee = data.config.origination_fee.clone();

    let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
        .await
        .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

    Ok(AppJson(LoanOffer {
        id: loan_offer.loan_deal_id,
        lender: lender_stats,
        name: loan_offer.name,
        min_ltv: loan_offer.min_ltv,
        interest_rate: loan_offer.interest_rate,
        loan_amount_min: loan_offer.loan_amount_min,
        loan_amount_max: loan_offer.loan_amount_max,
        duration_days_min: loan_offer.duration_days_min,
        duration_days_max: loan_offer.duration_days_max,
        loan_asset: loan_offer.loan_asset,
        loan_payout: loan_offer.loan_payout,
        status: loan_offer.status,
        loan_repayment_address: loan_offer.loan_repayment_address,
        origination_fee,
        kyc_link: loan_offer.kyc_link,
        lender_pk: loan_offer.lender_pk,
        repayment_plan: loan_offer.repayment_plan,
    }))
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
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
    duration_days_min: i32,
    duration_days_max: i32,
    loan_asset: LoanAsset,
    loan_payout: LoanPayout,
    status: LoanOfferStatus,
    loan_repayment_address: String,
    origination_fee: Vec<OriginationFee>,
    kyc_link: Option<Url>,
    #[schema(value_type = String)]
    lender_pk: PublicKey,
    repayment_plan: RepaymentPlan,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "PascalCase")]
pub enum QueryParamLoanType {
    /// Filter for direct loan offers only.
    Direct,
    /// Filter for indirect loan offers only.
    Indirect,
    /// Show all loan offers (both direct and indirect).
    All,
}

#[derive(Debug, Deserialize)]
struct LoanOffersQuery {
    loan_type: Option<QueryParamLoanType>,
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
    /// Referenced lender does not exist.
    MissingLender,
    /// Loan offer not found.
    MissingLoanOffer,
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
            Error::MissingLoanOffer => (StatusCode::BAD_REQUEST, "Loan offer not found".to_owned()),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
