use crate::db;
use crate::routes::borrower::auth::ErrorResponse;
use crate::routes::borrower::AppState;
use axum::body::Body;
use axum::extract::State;
use axum::http::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::IntoResponse;
use axum::Json;
use sha2::Digest;
use sha2::Sha256;
use std::sync::Arc;

pub(crate) async fn auth(
    State(data): State<Arc<AppState>>,
    mut req: Request<Body>,
    next: Next,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let api_key = req.headers().get("x-api-key").ok_or_else(|| {
        let json_error = ErrorResponse {
            message: "Missing API key.".to_string(),
        };
        (StatusCode::UNAUTHORIZED, Json(json_error))
    })?;

    let api_key = api_key.to_str().map_err(|_| {
        let json_error = ErrorResponse {
            message: "Invalid API key".to_string(),
        };
        (StatusCode::UNAUTHORIZED, Json(json_error))
    })?;

    let api_key_hash = Sha256::digest(api_key.as_bytes());
    let api_key_hash = hex::encode(api_key_hash);

    // Check if the requester has an API key that allows them to create API accounts.
    let maybe_key = db::api_account_creator::authenticate(&data.db, &api_key_hash)
        .await
        .map_err(|e| {
            tracing::error!("Error when loading api key from db {e:#}");

            let json_error = ErrorResponse {
                message: "Internal server error".to_string(),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json_error))
        })?;

    match maybe_key {
        None => {
            let json_error = ErrorResponse {
                message: "Invalid API key".to_string(),
            };
            return Err((StatusCode::UNAUTHORIZED, Json(json_error)));
        }
        Some(api_key) => {
            req.extensions_mut().insert(api_key);
        }
    }

    Ok(next.run(req).await)
}
