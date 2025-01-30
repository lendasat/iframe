use crate::routes::AppState;
use crate::user_stats::BorrowerStats;
use crate::user_stats::LenderStats;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde::Serialize;
use std::sync::Arc;

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/lenders/:id", get(get_lender_stats))
        .route("/api/borrowers/:id", get(get_borrower_stats))
}

pub enum Error {
    /// Failed to interact with the database.
    Database(sqlx::Error),
}

// Create our own JSON extractor by wrapping `axum::Json`. This makes it easy to override the
// rejection and provide our own which formats errors to match our application.
//
// `axum::Json` responds with plain text if the input is invalid.
#[derive(Debug, FromRequest)]
#[from_request(via(Json), rejection(Error))]
pub struct AppJson<T>(T);

impl<T> IntoResponse for AppJson<T>
where
    Json<T>: IntoResponse,
{
    fn into_response(self) -> Response {
        Json(self.0).into_response()
    }
}

/// Tell `axum` how [`AppError`] should be converted into a response.
///
/// This is also a convenient place to log errors.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::Database(e) => {
                // If we configure `tracing` properly, we don't need to add extra context here!
                tracing::error!("Database error: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

pub async fn get_lender_stats(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
) -> Result<AppJson<LenderStats>, Error> {
    let lender_stats = crate::user_stats::get_lender_stats(&data.db, lender_id.as_str())
        .await
        .map_err(Error::from)?;

    Ok(AppJson(lender_stats))
}

impl From<crate::user_stats::Error> for Error {
    fn from(value: crate::user_stats::Error) -> Self {
        match value {
            crate::user_stats::Error::Database(error) => Error::Database(error),
        }
    }
}

pub async fn get_borrower_stats(
    State(data): State<Arc<AppState>>,
    Path(borrower_id): Path<String>,
) -> Result<AppJson<BorrowerStats>, Error> {
    let borrower_stats = crate::user_stats::get_borrower_stats(&data.db, borrower_id.as_str())
        .await
        .map_err(Error::from)?;

    Ok(AppJson(borrower_stats))
}
