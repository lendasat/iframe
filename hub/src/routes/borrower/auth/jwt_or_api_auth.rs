use crate::db;
use crate::model::Borrower;
use crate::model::TokenClaims;
use crate::routes::borrower::AppState;
use axum::body::Body;
use axum::extract::FromRequest;
use axum::extract::State;
use axum::http::header;
use axum::http::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Json;
use axum_extra::extract::cookie::CookieJar;
use jsonwebtoken::decode;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::Validation;
use serde::Serialize;
use std::sync::Arc;

/// Authentication middleware to check if the cookie is still active and the user is still logged
/// in, or to check if the provided `x-api-key` header value authenticates the requester.
pub(crate) async fn auth(
    cookie_jar: CookieJar,
    State(data): State<Arc<AppState>>,
    mut req: Request<Body>,
    next: Next,
) -> Result<impl IntoResponse, Error> {
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
            .map_err(|_| Error::InvalidToken)?
            .claims
            .user_id
        }
        None => {
            let api_key = req
                .headers()
                .get("x-api-key")
                .ok_or(Error::MissingJwtOrApiKey)?;

            let api_key = api_key.to_str().map_err(|_| Error::InvalidApiKey)?;

            db::api_keys::authenticate_borrower(&data.db, api_key)
                .await
                .map_err(Error::database)?
                .ok_or(Error::InvalidApiKey)?
        }
    };

    let borrower: Option<Borrower> = db::borrowers::get_user_by_id(&data.db, user_id.as_str())
        .await
        .map_err(Error::database)?;

    let user = borrower.ok_or(Error::UserNotFound)?;

    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

// Create our own JSON extractor by wrapping `axum::Json`. This makes it easy to override the
// rejection and provide our own which formats errors to match our application.
//
// `axum::Json` responds with plain text if the input is invalid.
#[derive(Debug, FromRequest)]
#[from_request(via(Json), rejection(Error))]
struct AppJson<T>(T);

impl<T> IntoResponse for AppJson<T>
where
    Json<T>: IntoResponse,
{
    fn into_response(self) -> Response {
        Json(self.0).into_response()
    }
}

#[derive(Debug)]
pub enum Error {
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Invalid token.
    InvalidToken,
    /// Missing JWT or API key.
    MissingJwtOrApiKey,
    /// Invalid API key.
    InvalidApiKey,
    /// User not found.
    UserNotFound,
    /// The request body contained invalid JSON.
    JsonRejection(axum::extract::rejection::JsonRejection),
}

impl Error {
    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
    }
}

impl From<axum::extract::rejection::JsonRejection> for Error {
    fn from(rejection: axum::extract::rejection::JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

/// Tell `axum` how [`Error`] should be converted into a response.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::JsonRejection(rejection) => {
                // This error is caused by bad user input so don't log it
                (rejection.status(), rejection.body_text())
            }
            Error::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid token".to_owned()),
            Error::MissingJwtOrApiKey => (
                StatusCode::UNAUTHORIZED,
                "Missing JWT or API key.".to_owned(),
            ),
            Error::InvalidApiKey => (StatusCode::UNAUTHORIZED, "Invalid API key".to_owned()),
            Error::UserNotFound => (
                StatusCode::UNAUTHORIZED,
                "The user belonging to this token no longer exists".to_owned(),
            ),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
