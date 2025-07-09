use crate::routes::AppState;
use crate::user_stats::LenderStats;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Json;
use serde::Serialize;
use std::sync::Arc;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) const LENDER_PROFILES_TAG: &str = "lender-profiles";

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_lender_stats))
        .with_state(app_state)
}

/// Get public statistics for a lender.
#[utoipa::path(
    get,
    path = "/{id}",
    tag = LENDER_PROFILES_TAG,
    params(
        ("id" = String, Path, description = "Lender ID")
    ),
    responses(
        (
            status = 200,
            description = "Lender statistics",
            body = LenderStats
        )
    )
)]
pub async fn get_lender_stats(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
) -> Result<AppJson<LenderStats>, Error> {
    let lender_stats = crate::user_stats::get_lender_stats(&data.db, lender_id.as_str())
        .await
        .map_err(Error::from)?;

    Ok(AppJson(lender_stats))
}

pub enum Error {
    /// Failed to interact with the database.
    Database(sqlx::Error),
}

impl From<crate::user_stats::Error> for Error {
    fn from(value: crate::user_stats::Error) -> Self {
        match value {
            crate::user_stats::Error::Database(error) => Error::Database(error),
        }
    }
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

/// Tell `axum` how [`Error`] should be converted into a response.
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
