use crate::db;
use crate::model::Lender;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::lender::CHAT_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::AppState;
use axum::extract::FromRequest;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(new_chat_notification))
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

/// Send a new chat notification to the borrower associated with a contract.
#[utoipa::path(
    post,
    path = "/api/chat/notification",
    tag = CHAT_TAG,
    request_body = NotifyUser,
    responses(
        (
            status = 200,
            description = "Chat notification sent successfully"
        ),
        (
            status = 400,
            description = "Contract not found or borrower not found"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(lender_id = user.id), err(Debug))]
async fn new_chat_notification(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Json(body): Json<NotifyUser>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        body.contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(Error::database)?
    .ok_or(Error::MissingContract)?;

    let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingBorrower)?;

    let loan_url = data
        .config
        .borrower_frontend_origin
        .join(format!("/my-contracts/{}", body.contract_id.as_str()).as_str())
        .expect("to be a correct URL");

    data.notifications
        .send_chat_notification_borrower(body.contract_id.as_str(), borrower, loan_url)
        .await;

    Ok(())
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
struct NotifyUser {
    contract_id: String,
}

#[derive(Debug)]
enum Error {
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Borrower not found.
    MissingBorrower,
    /// Contract not found.
    MissingContract,
}

impl Error {
    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
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
            Error::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::MissingBorrower => (StatusCode::BAD_REQUEST, "Lender not found".to_owned()),
            Error::MissingContract => (StatusCode::BAD_REQUEST, "Contract not found".to_owned()),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
