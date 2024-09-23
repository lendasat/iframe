use crate::db;
use crate::routes::borrower::auth::jwt_auth::auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde::Serialize;
use std::sync::Arc;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/lenders/:id", get(get_lender_profile))
        .route("/api/borrowers/:id", get(get_borrower_profile))
        .route_layer(middleware::from_fn_with_state(app_state.clone(), auth))
        .with_state(app_state)
}

#[derive(Serialize, Debug)]
pub struct Profile {
    name: String,
    id: String,
}

pub async fn get_lender_profile(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
) -> impl IntoResponse {
    let maybe_lender = db::lenders::get_user_by_id(&data.db, lender_id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    match maybe_lender {
        None => {
            let error_response = ErrorResponse {
                message: "Lender not found".to_string(),
            };
            Err((StatusCode::NOT_FOUND, Json(error_response)))
        }
        Some(lender) => Ok(Json(Profile {
            name: lender.name,
            id: lender.id,
        })),
    }
}

pub async fn get_borrower_profile(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
) -> impl IntoResponse {
    let maybe_profile = db::borrowers::get_user_by_id(&data.db, lender_id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    match maybe_profile {
        None => {
            let error_response = ErrorResponse {
                message: "Borrower not found".to_string(),
            };
            Err((StatusCode::NOT_FOUND, Json(error_response)))
        }
        Some(lender) => Ok(Json(Profile {
            name: lender.name,
            id: lender.id,
        })),
    }
}
