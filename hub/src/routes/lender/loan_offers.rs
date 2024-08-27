use crate::db;
use crate::model::CreateLoanOfferSchema;
use crate::model::User;
use crate::routes::lender::auth;
use crate::routes::lender::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/offers",
            get(get_loan_offers_by_lender).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .route(
            "/api/offers/create",
            post(create_loan_offer).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[instrument(skip_all, err(Debug))]
pub async fn create_loan_offer(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Json(body): Json<CreateLoanOfferSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loan = db::loan_offers::insert_loan_offer(&data.db, body, user.id)
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
pub async fn get_loan_offers_by_lender(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loans = db::loan_offers::load_all_loan_offers_by_lender(&data.db, user.id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    Ok((StatusCode::OK, Json(loans)))
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
