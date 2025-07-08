use crate::db;
use crate::model::Borrower;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::PROFILE_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::AppState;
use axum::extract::FromRequest;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(update_profile))
        .routes(routes!(update_locale))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

/// Update borrower profile settings including timezone.
#[utoipa::path(
    put,
    path = "/",
    tag = PROFILE_TAG,
    request_body = UpdateProfile,
    responses(
        (
            status = 200,
            description = "Profile updated successfully"
        ),
        (
            status = 400,
            description = "Invalid timezone provided"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id = user.id), err(Debug))]
async fn update_profile(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Json(body): Json<UpdateProfile>,
) -> Result<(), Error> {
    if body.timezone.is_empty() {
        return Err(Error::InvalidTimezone);
    }

    let borrower_id = user.id;

    // Eventually this will find its way into `time`-crate, but for now we need to depend on it
    // directly. See https://github.com/time-rs/time/issues/193
    if tzdb::tz_by_name(body.timezone.as_str()).is_none() {
        return Err(Error::InvalidTimezone);
    }

    db::borrowers::update_borrower_timezone(&data.db, borrower_id.as_str(), body.timezone.as_str())
        .await
        .map_err(Error::Database)?;

    Ok(())
}

/// Update borrower locale preferences.
#[utoipa::path(
    put,
    path = "/locale",
    tag = PROFILE_TAG,
    request_body = UpdateLocale,
    responses(
        (
            status = 200,
            description = "Locale updated successfully"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id = user.id), err(Debug))]
async fn update_locale(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Json(body): Json<UpdateLocale>,
) -> Result<(), Error> {
    let borrower_id = user.id;

    db::borrowers::update_borrower_locale(&data.db, borrower_id.as_str(), body.locale.as_deref())
        .await
        .map_err(Error::Database)?;

    Ok(())
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
struct UpdateProfile {
    timezone: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
struct UpdateLocale {
    locale: Option<String>,
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
enum Error {
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] anyhow::Error),
    /// Invalid timezone provided
    InvalidTimezone,
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
            Error::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::InvalidTimezone => (
                StatusCode::BAD_REQUEST,
                "Invalid timezone provided".to_owned(),
            ),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
