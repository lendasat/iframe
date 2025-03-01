use crate::db;
use crate::model::Borrower;
use crate::model::PasswordAuth;
use crate::model::TokenClaims;
use crate::routes::borrower::auth::ErrorResponse;
use crate::routes::borrower::AppState;
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
use std::sync::Arc;

/// Authentication middleware to check if the cookie is still active and the user is still logged
/// in.
pub async fn auth(
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

    let token = token.ok_or_else(|| {
        let json_error = ErrorResponse {
            message: "You are not logged in.".to_string(),
        };
        (StatusCode::UNAUTHORIZED, Json(json_error))
    })?;

    let claims = decode::<TokenClaims>(
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
    .claims;

    let borrower_id = &claims.user_id;
    let borrower: Option<Borrower> =
        match db::borrowers::get_user_by_id(&data.db, borrower_id).await {
            Ok(user) => user,
            Err(e) => {
                let json_error = ErrorResponse {
                    message: format!("Error fetching user from database: {}", e),
                };
                return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
            }
        };

    let borrower = borrower.ok_or_else(|| {
        let json_error = ErrorResponse {
            message: "The user belonging to this token no longer exists".to_string(),
        };
        (StatusCode::UNAUTHORIZED, Json(json_error))
    })?;

    let password_auth_info: Option<PasswordAuth> =
        match db::borrowers::get_password_auth_info_by_borrower_id(&data.db, borrower_id).await {
            Ok(user) => user,
            Err(e) => {
                let json_error = ErrorResponse {
                    message: format!(
                        "Error fetching password authentication info from database: {}",
                        e
                    ),
                };
                return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
            }
        };

    let password_auth_info = password_auth_info.ok_or_else(|| {
        let json_error = ErrorResponse {
            message: "The user belonging to this token does not have password authentication info"
                .to_string(),
        };
        (StatusCode::UNAUTHORIZED, Json(json_error))
    })?;

    req.extensions_mut().insert((borrower, password_auth_info));
    Ok(next.run(req).await)
}
