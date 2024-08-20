use crate::db;
use crate::routes::lender::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde::Serialize;
use std::sync::Arc;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/offers",
            get(get_loan_offers).with_state(app_state.clone()),
        )
        .with_state(app_state)
}

pub async fn get_loan_offers(
    State(data): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loans = db::loan_offers::load_all_loan_offers_by_lender(&data.db, "foo".to_string())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })
        .unwrap();

    Ok((StatusCode::OK, Json(loans)))
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
