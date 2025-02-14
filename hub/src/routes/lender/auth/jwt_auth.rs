use crate::db;
use crate::db::lenders::get_user_by_id;
use crate::model::Lender;
use crate::model::TokenClaims;
use crate::routes::lender::auth::ErrorResponse;
use crate::routes::lender::AppState;
use axum::body::Body;
use axum::extract::State;
use axum::http::header;
use axum::http::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::IntoResponse;
use axum::Json;
use axum_extra::extract::cookie::CookieJar;
use jsonwebtoken::decode;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::Validation;
use sha2::Digest;
use sha2::Sha256;
use std::sync::Arc;

/// Authentication middleware check if the cookie is still active and the user still logged in
pub(crate) async fn auth(
    cookie_jar: CookieJar,
    State(data): State<Arc<AppState>>,
    mut req: Request<Body>,
    next: Next,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let token = cookie_jar
        .get("token")
        .map(|cookie| cookie.value().to_string())
        .or_else(|| {
            req.headers()
                .get(header::AUTHORIZATION)
                .and_then(|auth_header| auth_header.to_str().ok())
                .and_then(|auth_value| {
                    auth_value
                        .strip_prefix("Bearer ")
                        .map(|stripped| stripped.to_owned())
                })
        });

    let user_id = match token {
        Some(token) => {
            decode::<TokenClaims>(
                &token,
                &DecodingKey::from_secret(data.config.jwt_secret.as_ref()),
                &Validation::default(),
            )
            .map_err(|_| {
                let json_error = ErrorResponse {
                    message: "Invalid token".to_string(),
                };
                (StatusCode::UNAUTHORIZED, Json(json_error))
            })?
            .claims
            .user_id
        }
        None => {
            let api_key = req.headers().get("x-api-key").ok_or_else(|| {
                let json_error = ErrorResponse {
                    message: "Missing JWT or API key.".to_string(),
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

            db::api_keys::authenticate_lender(&data.db, &api_key_hash)
                .await
                .map_err(|_| {
                    let json_error = ErrorResponse {
                        message: "Database Error".to_string(),
                    };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(json_error))
                })?
                .ok_or_else(|| {
                    let json_error = ErrorResponse {
                        message: "Invalid API key".to_string(),
                    };
                    (StatusCode::UNAUTHORIZED, Json(json_error))
                })?
        }
    };

    let user: Option<Lender> = match get_user_by_id(&data.db, user_id.as_str()).await {
        Ok(user) => user,
        Err(e) => {
            let json_error = ErrorResponse {
                message: format!("Error fetching user from database: {}", e),
            };
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
        }
    };

    let lender = user.ok_or_else(|| {
        let json_error = ErrorResponse {
            message: "The user belonging to this token no longer exists".to_string(),
        };
        (StatusCode::UNAUTHORIZED, Json(json_error))
    })?;

    req.extensions_mut().insert(lender);
    Ok(next.run(req).await)
}
