use crate::db;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanOfferStatus;
use crate::model::OriginationFee;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::borrower::contracts::LenderProfile;
use crate::routes::AppState;
use anyhow::Context;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Json;
use axum::Router;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/offers",
            get(get_all_available_loan_offers).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/offer/:id",
            get(get_loan_offer).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/offersbylender/:lender_id",
            get(get_available_loan_offers_by_lender).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoanOffer {
    pub id: String,
    pub lender: LenderProfile,
    pub name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub min_ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_max: Decimal,
    pub duration_months_min: i32,
    pub duration_months_max: i32,
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
    pub status: LoanOfferStatus,
    pub loan_repayment_address: String,
    pub origination_fee: Vec<OriginationFee>,
}

#[instrument(skip_all, err(Debug))]
pub async fn get_all_available_loan_offers(
    State(data): State<Arc<AppState>>,
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

    for loan_offer in loans {
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

        ret.push(LoanOffer {
            id: loan_offer.id,
            lender: LenderProfile {
                id: lender.id,
                name: lender.name,
            },
            name: loan_offer.name,
            min_ltv: loan_offer.min_ltv,
            interest_rate: loan_offer.interest_rate,
            loan_amount_min: loan_offer.loan_amount_min,
            loan_amount_max: loan_offer.loan_amount_max,
            duration_months_min: loan_offer.duration_months_min,
            duration_months_max: loan_offer.duration_months_max,
            loan_asset_type: loan_offer.loan_asset_type,
            loan_asset_chain: loan_offer.loan_asset_chain,
            status: loan_offer.status,
            loan_repayment_address: loan_offer.loan_repayment_address,
            origination_fee,
        })
    }

    Ok((StatusCode::OK, Json(ret)))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_available_loan_offers_by_lender(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
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
        .context("No lender found for contract")
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Illegal state error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    for loan_offer in available_loans {
        // TODO: filter available origination fees once we have more than one
        let origination_fee = data.config.origination_fee.clone();

        ret.push(LoanOffer {
            id: loan_offer.id,
            lender: LenderProfile {
                id: lender.id.clone(),
                name: lender.name.clone(),
            },
            name: loan_offer.name,
            min_ltv: loan_offer.min_ltv,
            interest_rate: loan_offer.interest_rate,
            loan_amount_min: loan_offer.loan_amount_min,
            loan_amount_max: loan_offer.loan_amount_max,
            duration_months_min: loan_offer.duration_months_min,
            duration_months_max: loan_offer.duration_months_max,
            loan_asset_type: loan_offer.loan_asset_type,
            loan_asset_chain: loan_offer.loan_asset_chain,
            status: loan_offer.status,
            loan_repayment_address: loan_offer.loan_repayment_address,
            origination_fee,
        })
    }

    Ok((StatusCode::OK, Json(ret)))
}

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
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
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
            Ok((
                StatusCode::OK,
                Json(LoanOffer {
                    id: loan_offer.id,
                    lender: LenderProfile {
                        id: lender.id,
                        name: lender.name,
                    },
                    name: loan_offer.name,
                    min_ltv: loan_offer.min_ltv,
                    interest_rate: loan_offer.interest_rate,
                    loan_amount_min: loan_offer.loan_amount_min,
                    loan_amount_max: loan_offer.loan_amount_max,
                    duration_months_min: loan_offer.duration_months_min,
                    duration_months_max: loan_offer.duration_months_max,
                    loan_asset_type: loan_offer.loan_asset_type,
                    loan_asset_chain: loan_offer.loan_asset_chain,
                    status: loan_offer.status,
                    loan_repayment_address: loan_offer.loan_repayment_address,
                    origination_fee,
                }),
            ))
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
