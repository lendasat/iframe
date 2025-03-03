use crate::db;
use crate::model::CreateApiAccountRequest;
use crate::model::CreateApiAccountResponse;
use crate::model::CreatorApiKey;
use crate::routes::borrower::auth::api_account_creator_auth;
use crate::routes::borrower::API_ACCOUNTS_TAG;
use crate::routes::AppState;
use anyhow::anyhow;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::State;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use reqwest::StatusCode;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router_openapi(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(post_create_api_account))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            api_account_creator_auth::auth,
        ))
        .with_state(app_state)
}

/// Create a user account with API key acccess
#[utoipa::path(
post,
path = "/",
tag = API_ACCOUNTS_TAG,
request_body = CreateApiAccountRequest,
responses(
    (
    status = 200,
    description = "If successful, return new user object which holds the new API key. Note: there API key is only returned once!",
    body = CreateApiAccountResponse,
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn post_create_api_account(
    State(data): State<Arc<AppState>>,
    Extension(creator_api_key): Extension<CreatorApiKey>,
    AppJson(body): AppJson<CreateApiAccountRequest>,
) -> Result<AppJson<CreateApiAccountResponse>, Error> {
    let mut db_tx = data
        .db
        .begin()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    let (borrower, api_key) = db::borrowers::register_api_account(
        &mut db_tx,
        &body.name,
        body.email.as_deref(),
        body.timezone.as_deref(),
        creator_api_key.id,
    )
    .await
    .map_err(Error::Database)?;

    db_tx
        .commit()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    tracing::debug!(borrower_id = %borrower.id, "Created API borrower account");

    Ok(AppJson(CreateApiAccountResponse {
        id: borrower.id,
        name: borrower.name,
        email: borrower.email,
        timezone: borrower.timezone,
        api_key,
    }))
}

/// All the errors related to the `keys` REST API.
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(anyhow::Error),
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
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

/// Tell `axum` how [`Error`] should be converted into a response.
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
            Error::JsonRejection(rejection) => {
                // This error is caused by bad user input so don't log it
                (rejection.status(), rejection.body_text())
            }
            Error::Database(e) => {
                // If we configure `tracing` properly, we don't need to add extra context here!
                tracing::error!("Database error: {e:#}");

                // Don't expose any details about the error to the client.
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
