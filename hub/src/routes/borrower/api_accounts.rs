use crate::db;
use crate::db::borrowers::RegisterAccountByokError;
use crate::model::CreateApiAccountRequest;
use crate::model::CreateApiAccountResponse;
use crate::model::CreatorApiKey;
use crate::routes::borrower::auth::api_account_creator_auth;
use crate::routes::borrower::API_ACCOUNTS_TAG;
use crate::routes::AppState;
use crate::utils::is_valid_email;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::State;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use reqwest::StatusCode;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

/// Request for creating an API account with BYOK (Bring Your Own Key)
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateApiAccountByokRequest {
    pub name: String,
    pub email: String,
    pub timezone: Option<String>,
    pub api_key: String,
    pub referral_code: String,
}

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(post_create_api_account))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            api_account_creator_auth::auth,
        ))
        .routes(routes!(post_create_api_account_byok))
        .with_state(app_state)
}

/// Create a borrower API account i.e. a borrower account designed to interact with the Lendasat
/// server with an API key.
#[utoipa::path(
post,
path = "/",
tag = API_ACCOUNTS_TAG,
request_body = CreateApiAccountRequest,
responses(
    (
    status = 200,
    description = "If successful, return new user object which holds the new API key. Note: the API key is only returned once!",
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
    let mut db_tx = data.db.begin().await.map_err(Error::database)?;

    if let Some(ref email) = body.email {
        if !is_valid_email(email) {
            return Err(Error::InvalidEmail);
        }
    }

    // Generate API key for borrower account
    let (api_key, api_key_hash) = crate::api_keys::ApiKey::generate();

    let borrower = db::borrowers::register_api_account(
        &mut db_tx,
        &body.name,
        body.email.as_deref(),
        body.timezone.as_deref(),
        creator_api_key.id,
        &api_key_hash,
    )
    .await
    .map_err(Error::database)?;

    db_tx.commit().await.map_err(Error::database)?;

    tracing::debug!(borrower_id = %borrower.id, "Created API borrower account");

    Ok(AppJson(CreateApiAccountResponse {
        id: borrower.id,
        name: borrower.name,
        email: borrower.email,
        timezone: borrower.timezone,
        api_key: api_key.full_key().to_string(),
    }))
}

/// Create a borrower API account with a client-generated API key (BYOK - Bring Your Own Key).
#[utoipa::path(
post,
path = "/byok",
tag = API_ACCOUNTS_TAG,
request_body = CreateApiAccountByokRequest,
responses(
    (
    status = 200,
    description = "If successful, return new user object with the provided API key. Note: the API key is returned as provided!",
    body = CreateApiAccountResponse,
    )
)
)]
#[instrument(skip_all, err(Debug))]
async fn post_create_api_account_byok(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<CreateApiAccountByokRequest>,
) -> Result<AppJson<CreateApiAccountResponse>, Error> {
    let mut db_tx = data.db.begin().await.map_err(Error::database)?;

    let is_referral_code_valid =
        db::borrowers_referral_code::is_referral_code_valid(&data.db, body.referral_code.as_str())
            .await
            .map_err(Error::database)?;

    if !is_referral_code_valid {
        return Err(Error::InvalidReferralCode);
    }

    // Parse and validate the provided API key. We also generate an API key hash in case this is
    // actually a new API key.
    let (_, api_key_hash) = crate::api_keys::ApiKey::new_from_full_key(&body.api_key)
        .map_err(|_| Error::InvalidApiKey)?;

    // We are not modelling `UsedApiKey` errors. In any case, we would not want to tell the client
    // "you have stumbled on a used API key" explicitly. In such a scenario, we return a 500
    // instead.
    let borrower = db::borrowers::register_api_account_byok(
        &mut db_tx,
        &body.name,
        &body.email,
        body.timezone.as_deref(),
        &api_key_hash,
    )
    .await?;

    db::borrowers_referral_code::insert_referred_borrower(
        &mut *db_tx,
        body.referral_code.as_str(),
        borrower.id.as_str(),
    )
    .await
    .map_err(Error::database)?;

    db_tx.commit().await.map_err(Error::database)?;

    tracing::debug!(borrower_id = %borrower.id, "Created BYOK API borrower account");

    Ok(AppJson(CreateApiAccountResponse {
        id: borrower.id,
        name: borrower.name,
        email: borrower.email,
        timezone: borrower.timezone,
        api_key: body.api_key, // Return the same API key that was provided
    }))
}

/// All the errors related to the `keys` REST API.
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Invalid email.
    InvalidEmail,
    /// Invalid referral code.
    InvalidReferralCode,
    /// Invalid API key format.
    InvalidApiKey,
    /// Email already in use.
    UsedEmail,
}

impl Error {
    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
    }
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
            Error::InvalidEmail => (StatusCode::BAD_REQUEST, "Invalid email address".to_owned()),
            Error::InvalidReferralCode => {
                (StatusCode::BAD_REQUEST, "Invalid referral code".to_owned())
            }
            Error::InvalidApiKey => (
                StatusCode::BAD_REQUEST,
                "Invalid API key format. Expected format: lndst_sk_{key_id}_{secret}".to_owned(),
            ),
            Error::UsedEmail => (StatusCode::BAD_REQUEST, "Email already in use".to_owned()),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

impl From<RegisterAccountByokError> for Error {
    fn from(value: RegisterAccountByokError) -> Self {
        match value {
            RegisterAccountByokError::Database(e) => Error::database(e),
            RegisterAccountByokError::UsedEmail => Error::UsedEmail,
        }
    }
}
