use crate::db;
use crate::model::Borrower;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::PROFILE_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::AppState;
use crate::totp_helpers::create_totp_borrower;
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
use totp_rs::Secret;
use tracing::instrument;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(update_profile))
        .routes(routes!(update_locale))
        .routes(routes!(setup_totp))
        .routes(routes!(verify_totp))
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
    /// Invalid TOTP code provided
    InvalidTotpCode,
    /// Failed to generate TOTP secret
    TotpGenerationFailed,
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
            Error::InvalidTotpCode => (
                StatusCode::BAD_REQUEST,
                "Invalid TOTP code provided".to_owned(),
            ),
            Error::TotpGenerationFailed => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to generate TOTP secret".to_owned(),
            ),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

#[derive(Debug, Serialize, ToSchema)]
struct TotpSetupResponse {
    qr_code_uri: String,
    secret: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
struct VerifyTotpRequest {
    totp_code: String,
}

/// Generate TOTP secret and QR code for setup
#[utoipa::path(
    post,
    path = "/totp/setup",
    tag = PROFILE_TAG,
    responses(
        (
            status = 200,
            description = "TOTP setup information generated successfully",
            body = TotpSetupResponse
        ),
        (
            status = 500,
            description = "Failed to generate TOTP secret"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id = user.id), err(Debug))]
async fn setup_totp(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
) -> Result<Json<TotpSetupResponse>, Error> {
    // Check if TOTP is already enabled
    let existing_secret = db::borrowers::get_totp_secret(&data.db, &user.id)
        .await
        .map_err(Error::Database)?;

    if existing_secret.is_some() {
        return Err(Error::InvalidTotpCode); // TOTP already enabled
    }

    let secret = Secret::generate_secret();
    let secret_str = secret.to_encoded().to_string();

    // Store the secret temporarily (not enabled yet)
    db::borrowers::store_totp_secret(&data.db, &user.id, &secret_str)
        .await
        .map_err(Error::Database)?;

    let totp = create_totp_borrower(secret, user.email.unwrap_or_else(|| user.name.clone()))
        .map_err(|_| Error::TotpGenerationFailed)?;

    let qr_code_uri = totp.get_url();

    let qr_code_uri = format!("{qr_code_uri}&image=https://lendasat.com/img/logo_128_128.png");

    Ok(Json(TotpSetupResponse {
        qr_code_uri,
        secret: secret_str,
    }))
}

/// Verify TOTP code and enable TOTP for the user
#[utoipa::path(
    post,
    path = "/totp/verify",
    tag = PROFILE_TAG,
    request_body = VerifyTotpRequest,
    responses(
        (
            status = 200,
            description = "TOTP verified and enabled successfully"
        ),
        (
            status = 400,
            description = "Invalid TOTP code provided"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id = user.id), err(Debug))]
async fn verify_totp(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Json(body): Json<VerifyTotpRequest>,
) -> Result<(), Error> {
    // Check if user already has TOTP enabled
    let existing_enabled_secret = db::borrowers::get_totp_secret(&data.db, &user.id)
        .await
        .map_err(Error::Database)?;

    if existing_enabled_secret.is_some() {
        return Err(Error::InvalidTotpCode); // TOTP already enabled
    }

    // Get the secret from setup (even if not enabled yet)
    let secret_str = db::borrowers::get_totp_secret_for_setup(&data.db, &user.id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::InvalidTotpCode)?; // No secret found, must call setup first

    let secret = Secret::Encoded(secret_str.clone());

    let totp = create_totp_borrower(secret, user.email.unwrap_or_else(|| user.name.clone()))
        .map_err(|_| Error::TotpGenerationFailed)?;

    // Verify the provided TOTP code
    if !totp
        .check_current(&body.totp_code)
        .map_err(|_| Error::InvalidTotpCode)?
    {
        return Err(Error::InvalidTotpCode);
    }

    // Enable TOTP (secret is already stored)
    db::borrowers::enable_totp(&data.db, &user.id)
        .await
        .map_err(Error::Database)?;

    Ok(())
}
