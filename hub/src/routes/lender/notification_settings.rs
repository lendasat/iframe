use crate::db::notification_settings;
use crate::model::Lender;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::lender::NOTIFICATION_SETTINGS_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use axum::extract::rejection::JsonRejection;
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
        .routes(routes!(get_notification_settings))
        .routes(routes!(put_notification_settings))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_auth::auth,
        ))
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LenderNotificationSettingsResponse {
    pub on_login_email: bool,
    pub on_login_telegram: bool,
    pub daily_application_digest_email: bool,
    pub new_loan_applications_telegram: bool,
    pub contract_status_changed_email: bool,
    pub contract_status_changed_telegram: bool,
    pub new_chat_message_email: bool,
    pub new_chat_message_telegram: bool,
}

impl From<crate::model::notifications::LenderNotificationSettings>
    for LenderNotificationSettingsResponse
{
    fn from(settings: crate::model::notifications::LenderNotificationSettings) -> Self {
        Self {
            on_login_email: settings.on_login_email,
            on_login_telegram: settings.on_login_telegram,
            daily_application_digest_email: settings.daily_application_digest_email,
            new_loan_applications_telegram: settings.new_loan_applications_telegram,
            contract_status_changed_email: settings.contract_status_changed_email,
            contract_status_changed_telegram: settings.contract_status_changed_telegram,
            new_chat_message_email: settings.new_chat_message_email,
            new_chat_message_telegram: settings.new_chat_message_telegram,
        }
    }
}

/// Get lender notification settings.
#[utoipa::path(
    get,
    path = "/",
    tag = NOTIFICATION_SETTINGS_TAG,
    responses(
        (
            status = 200,
            description = "Lender notification settings",
            body = LenderNotificationSettingsResponse
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(lender_id = user.id), ret, err(Debug))]
async fn get_notification_settings(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Extension(_connection_details): Extension<UserConnectionDetails>,
) -> Result<AppJson<LenderNotificationSettingsResponse>, Error> {
    let settings = notification_settings::get_lender_notification_settings(&data.db, &user.id)
        .await
        .map_err(Error::database)?;

    let response = LenderNotificationSettingsResponse::from(settings);
    Ok(AppJson(response))
}

/// Update lender notification settings.
#[utoipa::path(
    put,
    path = "/",
    request_body = LenderNotificationSettingsResponse,
    tag = NOTIFICATION_SETTINGS_TAG,
    responses(
        (
            status = 200,
            description = "Updated lender notification settings",
            body = LenderNotificationSettingsResponse
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(lender_id = user.id), ret, err(Debug))]
async fn put_notification_settings(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Extension(_connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<LenderNotificationSettingsResponse>,
) -> Result<AppJson<LenderNotificationSettingsResponse>, Error> {
    let settings = crate::model::notifications::LenderNotificationSettings {
        lender_id: user.id.clone(),
        on_login_email: body.on_login_email,
        on_login_telegram: body.on_login_telegram,
        daily_application_digest_email: body.daily_application_digest_email,
        new_loan_applications_telegram: body.new_loan_applications_telegram,
        contract_status_changed_email: body.contract_status_changed_email,
        contract_status_changed_telegram: body.contract_status_changed_telegram,
        new_chat_message_email: body.new_chat_message_email,
        new_chat_message_telegram: body.new_chat_message_telegram,
    };

    let updated_settings =
        notification_settings::update_lender_notification_settings(&data.db, &user.id, &settings)
            .await
            .map_err(Error::database)?;

    let response = LenderNotificationSettingsResponse::from(updated_settings);
    Ok(AppJson(response))
}

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("JSON was malformed: {0}")]
    JsonRejection(JsonRejection),
    #[error("Database error: {0}")]
    Database(String),
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
            Error::JsonRejection(rejection) => (rejection.status(), rejection.body_text()),
            Error::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
        };

        let body = Json(ErrorResponse { message });

        (status, body).into_response()
    }
}
