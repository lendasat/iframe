use crate::db;
use crate::model::Borrower;
use crate::model::PasswordAuth;
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
/// in.
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

    let token = token.ok_or(Error::NotLoggedIn)?;

    let claims = decode::<TokenClaims>(
        &token,
        &DecodingKey::from_secret(data.config.jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| Error::InvalidToken)?
    .claims;

    let borrower_id = &claims.user_id;
    let borrower: Option<Borrower> = db::borrowers::get_user_by_id(&data.db, borrower_id)
        .await
        .map_err(Error::database)?;

    let borrower = borrower.ok_or(Error::UserNotFound)?;

    let password_auth_info: Option<PasswordAuth> =
        db::borrowers::get_password_auth_info_by_borrower_id(&data.db, borrower_id)
            .await
            .map_err(Error::database)?;

    let password_auth_info = password_auth_info.ok_or(Error::NoPasswordAuth)?;

    req.extensions_mut().insert((borrower, password_auth_info));
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
pub(crate) enum Error {
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// User not logged in.
    NotLoggedIn,
    /// Invalid token.
    InvalidToken,
    /// User not found.
    UserNotFound,
    /// No password authentication.
    NoPasswordAuth,
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
            Error::NotLoggedIn => (
                StatusCode::UNAUTHORIZED,
                "You are not logged in.".to_owned(),
            ),
            Error::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid token".to_owned()),
            Error::UserNotFound => (
                StatusCode::UNAUTHORIZED,
                "The user belonging to this token no longer exists".to_owned(),
            ),
            Error::NoPasswordAuth => (
                StatusCode::UNAUTHORIZED,
                "The user belonging to this token does not have password authentication info"
                    .to_owned(),
            ),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
