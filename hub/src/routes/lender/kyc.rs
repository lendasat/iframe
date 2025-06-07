use crate::db;
use crate::model::Lender;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::lender::KYC_TAG;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::Extension;
use axum::Json;
use std::sync::Arc;
use tracing::instrument;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(put_approve_kyc))
        .routes(routes!(put_reject_kyc))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_auth::auth,
        ))
        .with_state(app_state.clone())
}

/// Approve KYC for a borrower.
#[utoipa::path(
    put,
    path = "/{borrower_id}/approve",
    tag = KYC_TAG,
    params(
        ("borrower_id" = String, Path, description = "ID of the borrower to approve KYC for")
    ),
    responses(
        (
            status = 200,
            description = "KYC approved successfully"
        ),
        (
            status = 500,
            description = "Database error"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
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

/// Reject KYC for a borrower.
#[utoipa::path(
    put,
    path = "/{borrower_id}/reject",
    tag = KYC_TAG,
    params(
        ("borrower_id" = String, Path, description = "ID of the borrower to reject KYC for")
    ),
    responses(
        (
            status = 200,
            description = "KYC rejection logged successfully"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(skip(_data, user), err(Debug))]
pub async fn put_reject_kyc(
    State(_data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(borrower_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let lender_id = user.id;

    // Logging is sufficient for now. The KYC process remains in state `is_done=false`.
    tracing::debug!(borrower_id, lender_id, "KYC rejected");

    Ok(())
}
