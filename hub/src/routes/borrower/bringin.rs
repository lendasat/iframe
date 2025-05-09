use crate::bringin;
use crate::db;
use crate::model::Borrower;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::user_connection_details_middleware;
use crate::routes::AppState;
use crate::utils::is_valid_email;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tracing::instrument;
use url::Url;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/bringin/connect",
            post(post_connect_with_bringin).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/bringin/api-key",
            get(has_api_key).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .route(
            "/api/bringin/callback/verification-status",
            post(post_verification_status),
        )
        .route(
            "/api/bringin/callback/order-status",
            post(post_order_status_update_callback),
        )
        .route(
            "/api/bringin/callback/:borrower_id",
            post(post_user_connected_callback),
        )
        .with_state(app_state)
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PostConnectWithBringinRequest {
    pub bringin_email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PostConnectWithBringinResponse {
    pub signup_url: Option<Url>,
}

#[instrument(skip_all, fields(borrower_id = user.id, bringin_email = body.bringin_email), err(Debug), ret)]
#[axum::debug_handler]
async fn post_connect_with_bringin(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Json(body): Json<PostConnectWithBringinRequest>,
) -> Result<AppJson<PostConnectWithBringinResponse>, Error> {
    let bringin_email = body.bringin_email;

    if !is_valid_email(&bringin_email) {
        return Err(Error::InvalidEmail);
    }

    let borrower_id = user.id;

    let webhook_url = format!("{}/{}", data.config.bringin_webhook_url, borrower_id);
    let webhook_url = webhook_url.parse().expect("valid URL");

    let res = bringin::post_get_api_key(
        &data.config.bringin_url,
        &bringin_email,
        &borrower_id,
        webhook_url,
        &data.config.bringin_api_key,
        &data.config.bringin_api_secret,
    )
    .await
    .map_err(Error::bringin)?;

    let res = PostConnectWithBringinResponse {
        signup_url: res.signup_url,
    };

    Ok(AppJson(res))
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostVerificationStatus {
    /// Bringin user ID.
    pub user_id: String,
    pub apikey: String,
    #[serde(rename = "ref")]
    pub reference: String,
    pub verification_status: String,
}

#[instrument(skip_all, fields(borrower_id = body.reference, bringing_user_id = body.user_id), err(Debug), ret)]
#[axum::debug_handler]
async fn post_verification_status(
    State(data): State<Arc<AppState>>,
    Json(body): Json<PostVerificationStatus>,
) -> Result<(), Error> {
    tracing::info!(status = ?body, "Received verification status update");
    db::bringin::insert_api_key(&data.db, &body.user_id, &body.apikey)
        .await
        .map_err(Error::database)?;

    Ok(())
}

#[instrument(skip_all, err(Debug), ret)]
#[axum::debug_handler]
async fn post_order_status_update_callback(payload: Json<Value>) -> Result<(), Error> {
    tracing::info!(payload = ?payload, "Received order status update");

    Ok(())
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostUserConnectedRequest {
    /// Bringin user ID.
    pub user_id: String,
    pub apikey: String,
    #[serde(rename = "ref")]
    pub reference: String,
}

#[instrument(skip_all, fields(borrower_id, bringing_user_id = body.user_id), err(Debug), ret)]
#[axum::debug_handler]
async fn post_user_connected_callback(
    State(data): State<Arc<AppState>>,
    Path(borrower_id): Path<String>,
    Json(body): Json<PostUserConnectedRequest>,
) -> Result<(), Error> {
    db::bringin::insert_api_key(&data.db, &borrower_id, &body.apikey)
        .await
        .map_err(Error::database)?;

    Ok(())
}

#[derive(Serialize, Debug)]
pub struct ApiKey {
    has_key: bool,
}

#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn has_api_key(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
) -> Result<AppJson<ApiKey>, Error> {
    let has_key = db::bringin::get_api_key(&data.db, user.id.as_str())
        .await
        .map_err(Error::database)?
        .is_some();

    Ok(AppJson(ApiKey { has_key }))
}

// Error fields are allowed to be dead code because they are actually used when printed in logs.
#[allow(dead_code)]
#[derive(Debug)]
enum Error {
    /// Failed to interact with the database.
    Database(String),
    /// Got an error from Bringin.
    Bringin(String),
    /// Invalid email.
    InvalidEmail,
}

impl Error {
    fn database(error: anyhow::Error) -> Self {
        Self::Database(format!("{error:#}"))
    }

    fn bringin(error: anyhow::Error) -> Self {
        Self::Bringin(format!("{error:#}"))
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
            Error::Database(_) | Error::Bringin(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::InvalidEmail => (StatusCode::BAD_REQUEST, "Invalid email".to_owned()),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
