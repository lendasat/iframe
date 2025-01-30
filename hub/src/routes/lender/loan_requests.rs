use crate::db;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
use anyhow::Context;
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
            "/api/requests",
            get(get_all_available_loan_requests).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoanRequest {
    pub id: String,
    pub borrower: BorrowerProfile,
    #[serde(with = "rust_decimal::serde::float")]
    pub ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_days: i32,
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BorrowerProfile {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[instrument(skip_all, err(Debug))]
pub async fn get_all_available_loan_requests(
    State(data): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let requests = db::loan_requests::load_all_available_loan_requests(&data.db)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let mut ret = vec![];

    for request in requests {
        let borrower = db::borrowers::get_user_by_id(&data.db, &request.borrower_id)
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

        ret.push(LoanRequest {
            id: request.id,
            borrower: BorrowerProfile {
                id: borrower.id,
                name: borrower.name,
            },
            ltv: request.ltv,
            interest_rate: request.interest_rate,
            loan_amount: request.loan_amount,
            duration_days: request.duration_days,
            loan_asset_type: request.loan_asset_type,
            loan_asset_chain: request.loan_asset_chain,
        })
    }

    Ok((StatusCode::OK, Json(ret)))
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
