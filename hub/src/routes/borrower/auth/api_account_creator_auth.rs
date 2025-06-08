use crate::db;
use crate::routes::borrower::AppState;
use axum::body::Body;
use axum::extract::FromRequest;
use axum::extract::State;
use axum::http::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Json;
use serde::Serialize;
use sha2::Digest;
use sha2::Sha256;
use std::sync::Arc;

pub(crate) async fn auth(
    State(data): State<Arc<AppState>>,
    mut req: Request<Body>,
    next: Next,
) -> Result<impl IntoResponse, Error> {
    let api_key = req.headers().get("x-api-key").ok_or(Error::MissingApiKey)?;

    let api_key = api_key.to_str().map_err(|_| Error::InvalidApiKey)?;

    let api_key_hash = Sha256::digest(api_key.as_bytes());
    let api_key_hash = hex::encode(api_key_hash);

    // Check if the requester has an API key that allows them to create API accounts.
    let maybe_key = db::api_account_creator::authenticate(&data.db, &api_key_hash)
        .await
        .map_err(Error::database)?;

    match maybe_key {
        None => {
            return Err(Error::InvalidApiKey);
        }
        Some(api_key) => {
            req.extensions_mut().insert(api_key);
        }
    }

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
    /// Missing API key.
    MissingApiKey,
    /// Invalid API key.
    InvalidApiKey,
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
            Error::MissingApiKey => (StatusCode::UNAUTHORIZED, "Missing API key.".to_owned()),
            Error::InvalidApiKey => (StatusCode::UNAUTHORIZED, "Invalid API key".to_owned()),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
