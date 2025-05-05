use crate::db;
use crate::model::LoanAsset;
use crate::model::LoanOfferStatus;
use crate::model::LoanPayout;
use crate::model::OriginationFee;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::LOAN_OFFERS_TAG;
use crate::routes::AppState;
use crate::user_stats;
use crate::user_stats::LenderStats;
use anyhow::Context;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
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

pub(crate) fn router_openapi(app_state: Arc<AppState>) -> OpenApiRouter {
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

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct LoanOffer {
    pub id: String,
    pub lender: LenderStats,
    pub name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub min_ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_max: Decimal,
    pub duration_days_min: i32,
    pub duration_days_max: i32,
    pub loan_asset: LoanAsset,
    pub loan_payout: LoanPayout,
    pub status: LoanOfferStatus,
    pub loan_repayment_address: String,
    pub origination_fee: Vec<OriginationFee>,
    pub extension_origination_fee: Vec<OriginationFee>,
    pub kyc_link: Option<Url>,
    #[schema(value_type = String)]
    pub lender_pk: PublicKey,
}

#[derive(Debug, Deserialize, ToSchema)]
pub enum QueryParamLoanType {
    Direct,
    Indirect,
    All,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoanQueryParams {
    pub loan_type: Option<QueryParamLoanType>,
}

/// Return all available offers
#[utoipa::path(
get,
path = "/",
tag = LOAN_OFFERS_TAG,
params(
    ("loan_type" = Option<QueryParamLoanType>, Query, description = "Filter by loan type: direct, indirect. If none is provided, `direct` only will be returned")
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
pub async fn get_all_available_loan_offers(
    State(data): State<Arc<AppState>>,
    Query(params): Query<LoanQueryParams>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loans = db::loan_offers::load_all_available_loan_offers(&data.db)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let mut ret = vec![];

    let filter_by = params.loan_type.unwrap_or(QueryParamLoanType::Direct);

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
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?
            .context("No lender found for contract")
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Illegal state error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

        // TODO: filter available origination fees once we have more than one
        let origination_fee = data.config.origination_fee.clone();
        let extension_origination_fee = data.config.extension_origination_fee.clone();

        let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {:?}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

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
            extension_origination_fee,
            kyc_link: loan_offer.kyc_link,
            lender_pk: loan_offer.lender_pk,
        })
    }

    Ok((StatusCode::OK, Json(ret)))
}

/// Return loan offers by lender
#[utoipa::path(
get,
path = "/bylender/{id}",
params(
    (
    "loan_type" = Option<QueryParamLoanType>, Query, description = "Filter by loan type: direct, indirect. If none is provided, `direct` only will be returned")
    ),
params(
    (
    "id" = String, Path, description = "Lender id"
    )
),
tag = LOAN_OFFERS_TAG,
responses(
    (
    status = 200,
    description = "A list of loan offers by the specific lender",
    body = [LoanOffer]
    )
),
)
]
#[instrument(skip_all, err(Debug))]
pub async fn get_available_loan_offers_by_lender(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
    Query(params): Query<LoanQueryParams>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let available_loans =
        db::loan_offers::load_available_loan_offers_by_lender(&data.db, lender_id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    let mut ret = vec![];

    let lender = db::lenders::get_user_by_id(&data.db, &lender_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .context("No lender found for offer")
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Illegal state error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let filter_by = params.loan_type.unwrap_or(QueryParamLoanType::Direct);

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
        let extension_origination_fee = data.config.extension_origination_fee.clone();

        let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {:?}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

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
            extension_origination_fee,
            kyc_link: loan_offer.kyc_link,
            lender_pk: loan_offer.lender_pk,
        })
    }

    Ok((StatusCode::OK, Json(ret)))
}

/// Return specific loan offers
#[utoipa::path(
get,
path = "/{id}",
params(
    (
    "id" = String, Path, description = "Loan offer id"
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
pub async fn get_loan_offer(
    State(data): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loan = db::loan_offers::loan_by_id(&data.db, id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    match loan {
        None => {
            let error_response = ErrorResponse {
                message: "Loan offer not found".to_string(),
            };
            return Err((StatusCode::BAD_REQUEST, Json(error_response)));
        }
        Some(loan_offer) => {
            let lender = db::lenders::get_user_by_id(&data.db, &loan_offer.lender_id)
                .await
                .map_err(|error| {
                    let error_response = ErrorResponse {
                        message: format!("Database error: {}", error),
                    };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
                })?
                .context("No lender found for contract")
                .map_err(|error| {
                    let error_response = ErrorResponse {
                        message: format!("Illegal state error: {}", error),
                    };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
                })?;

            // TODO: filter available origination fees once we have more than one
            let origination_fee = data.config.origination_fee.clone();
            let extension_origination_fee = data.config.extension_origination_fee.clone();

            let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
                .await
                .map_err(|error| {
                    let error_response = ErrorResponse {
                        message: format!("Database error: {:?}", error),
                    };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
                })?;

            Ok((
                StatusCode::OK,
                Json(LoanOffer {
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
                    extension_origination_fee,
                    kyc_link: loan_offer.kyc_link,
                    lender_pk: loan_offer.lender_pk,
                }),
            ))
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
