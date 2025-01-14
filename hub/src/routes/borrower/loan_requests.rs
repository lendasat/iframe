use crate::db;
use crate::model::Borrower;
use crate::model::CreateLoanRequestSchema;
use crate::routes::borrower::auth;
use crate::routes::borrower::AppState;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::delete;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/requests",
            get(get_loan_requests_by_borrower).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .route(
            "/api/requests/:id",
            get(get_loan_request_by_borrower_and_request_id).route_layer(
                middleware::from_fn_with_state(app_state.clone(), auth::jwt_auth::auth),
            ),
        )
        .route(
            "/api/requests/:id",
            delete(delete_loan_request_by_borrower_and_request_id).route_layer(
                middleware::from_fn_with_state(app_state.clone(), auth::jwt_auth::auth),
            ),
        )
        .route(
            "/api/requests/create",
            post(create_loan_request).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

// TODO: we need to handle a loan request for a debit card separately. And throw an error if the
// user has already a card. In the future we will either allow multiple cards or allow the user to
// recharge his existing car.
#[instrument(skip_all, err(Debug))]
pub async fn create_loan_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Json(body): Json<CreateLoanRequestSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    if body.ltv > dec!(1.0) || body.ltv < Decimal::zero() {
        let error_response = ErrorResponse {
            message: format!("LTV must be between 0 and 1 but was {}", body.ltv),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    if body.interest_rate > dec!(1.0) || body.interest_rate < Decimal::zero() {
        let error_response = ErrorResponse {
            message: format!(
                "Interest rate must be between 0 and 1 but was {}",
                body.interest_rate
            ),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    if body.loan_amount.is_zero() {
        let error_response = ErrorResponse {
            message: "Loan amount must be non-zero".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let loan = db::loan_requests::insert_loan_request(&data.db, body, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    Ok((StatusCode::OK, Json(loan)))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_requests_by_borrower(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loans = db::loan_requests::load_all_loan_requests_by_borrower(&data.db, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    Ok((StatusCode::OK, Json(loans)))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_request_by_borrower_and_request_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(offer_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loan = db::loan_requests::get_loan_request_by_borrower_and_request_id(
        &data.db,
        user.id.as_str(),
        offer_id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok((StatusCode::OK, Json(loan)))
}

#[instrument(skip_all, err(Debug))]
pub async fn delete_loan_request_by_borrower_and_request_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(offer_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    db::loan_requests::mark_as_deleted_by_borrower_and_request_id(
        &data.db,
        user.id.as_str(),
        offer_id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok((StatusCode::OK, ()))
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
