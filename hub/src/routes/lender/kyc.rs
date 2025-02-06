use crate::db;
use crate::model::Lender;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use std::sync::Arc;
use tracing::instrument;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/kyc/:borrower_id/approve",
            put(put_approve_kyc).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/kyc/:borrower_id/reject",
            put(put_reject_kyc).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_approve_kyc(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(borrower_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let lender_id = user.id;

    db::kyc::approve(&data.db, &lender_id, &borrower_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    tracing::debug!(borrower_id, lender_id, "KYC approved");

    Ok(())
}

#[instrument(skip(user), err(Debug))]
pub async fn put_reject_kyc(
    State(_): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(borrower_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let lender_id = user.id;

    // Logging is sufficient for now. The KYC process remains in state `is_done=false`.
    tracing::debug!(borrower_id, lender_id, "KYC rejected");

    Ok(())
}
