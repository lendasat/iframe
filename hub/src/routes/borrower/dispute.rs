use crate::db;
use crate::model::Borrower;
use crate::model::DisputeRequestBodySchema;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::AppState;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::post;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/disputes",
            get(get_all_disputes_for_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/disputes",
            post(create_dispute).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/disputes/:dispute_id",
            put(add_message_to_dispute).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/disputes/:dispute_id/resolve",
            put(put_resolve_dispute).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .with_state(app_state)
}

async fn get_all_disputes_for_contract(
    State(data): State<Arc<AppState>>,
    query_params: Query<DisputeQueryParams>,
) -> Result<AppJson<Vec<db::contract_disputes::DisputeWithMessages>>, Error> {
    let disputes = db::contract_disputes::get_disputes_with_messages_by_contract(
        &data.db,
        query_params.contract_id.as_str(),
    )
    .await
    .map_err(Error::database)?;

    Ok(AppJson(disputes))
}

#[instrument(skip_all, fields(borrower_id = user.id, ?body), ret, err(Debug))]
async fn create_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    AppJson(body): AppJson<DisputeRequestBodySchema>,
) -> Result<AppJson<db::contract_disputes::ContractDispute>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        body.contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(Error::database)?;

    let disputes =
        db::contract_disputes::get_disputes_by_contract(&data.db, body.contract_id.as_str())
            .await
            .map_err(Error::database)?;

    if disputes.iter().any(|d| {
        d.status == db::contract_disputes::DisputeStatus::DisputeStartedBorrower
            || d.status == db::contract_disputes::DisputeStatus::DisputeStartedLender
            || d.status == db::contract_disputes::DisputeStatus::InProgress
    }) {
        return Err(Error::DisputeInProgress);
    }

    let comment = format!("{}. {}", body.reason, body.comment);
    let dispute = db::contract_disputes::start_dispute_borrower(
        &data.db,
        contract.id.as_str(),
        user.id.as_str(),
        comment.as_str(),
    )
    .await
    .map_err(Error::database)?;

    if let Some(ref email) = user.email {
        data.notifications
            .send_start_dispute(
                user.name.as_str(),
                email.as_str(),
                dispute.id.to_string().as_str(),
            )
            .await;
    }

    data.notifications
        .send_notify_admin_about_dispute_borrower(
            user,
            dispute.id.to_string().as_str(),
            contract.lender_id.as_str(),
            contract.borrower_id.as_str(),
            contract.id.as_str(),
        )
        .await;

    Ok(AppJson(dispute))
}

#[instrument(skip_all, fields(borrower_id = user.id, dispute_id), err(Debug), ret)]
async fn add_message_to_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(dispute_id): Path<Uuid>,
    AppJson(body): AppJson<DisputeMessage>,
) -> Result<(), Error> {
    db::contract_disputes::add_borrower_message(&data.db, dispute_id, user.id, body.message)
        .await
        .map_err(Error::database)?;

    Ok(())
}

#[instrument(skip_all, fields(borrower_id = user.id, dispute_id), err(Debug), ret)]
async fn put_resolve_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(dispute_id): Path<Uuid>,
) -> Result<(), Error> {
    let dispute = db::contract_disputes::get_dispute_by_dispute_id(&data.db, dispute_id)
        .await
        .map_err(Error::database)?;

    if dispute.status != db::contract_disputes::DisputeStatus::DisputeStartedBorrower {
        return Err(Error::DisputeNotStartedByBorrower);
    }

    db::contract_disputes::resolve_borrower(&data.db, dispute_id, user.id.as_str())
        .await
        .map_err(Error::database)?;

    Ok(())
}

#[derive(Deserialize)]
struct DisputeQueryParams {
    contract_id: String,
}

#[derive(Deserialize, Debug)]
struct DisputeMessage {
    message: String,
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
    Database(#[allow(dead_code)] String),
    /// Dispute already in progress.
    DisputeInProgress,
    /// Dispute was not started by borrower.
    DisputeNotStartedByBorrower,
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
            Error::DisputeInProgress => (
                StatusCode::BAD_REQUEST,
                "Dispute already in progress".to_owned(),
            ),
            Error::DisputeNotStartedByBorrower => (
                StatusCode::BAD_REQUEST,
                "Dispute was not started by you".to_owned(),
            ),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
