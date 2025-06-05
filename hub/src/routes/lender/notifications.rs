use crate::db;
use crate::model::Lender;
use crate::model::NotificationMessage;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
use anyhow::anyhow;
use axum::extract::rejection::JsonRejection;
use axum::extract::ws::WebSocket;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use futures::SinkExt;
use futures::StreamExt;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/notifications",
            get(get_all_notifications).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/notifications/:id",
            put(put_mark_as_read).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/notifications",
            put(put_mark_all_as_read).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/notifications/ws",
            get(notifications_ws).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default = "default_unread_only")]
    pub unread_only: bool,
}

fn default_page() -> u32 {
    1
}
fn default_limit() -> u32 {
    20
}

fn default_unread_only() -> bool {
    true
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub page: u32,
    pub limit: u32,
    pub total: u64,
    pub total_pages: u32,
}

impl PaginationQuery {
    pub fn offset(&self) -> u32 {
        (self.page - 1) * self.limit
    }

    pub fn validate(&self) -> Result<(), &'static str> {
        if self.page == 0 {
            return Err("Page must be greater than 0");
        }
        if self.limit == 0 || self.limit > 100 {
            return Err("Limit must be between 1 and 100");
        }
        Ok(())
    }
}

async fn get_all_notifications(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Query(pagination): Query<PaginationQuery>,
) -> Result<AppJson<PaginatedResponse<NotificationMessage>>, Error> {
    pagination
        .validate()
        .map_err(|e| Error::bad_request(anyhow!(e)))?;

    let total_contract_notifications =
        db::notifications::count_contract_notifications_by_lender_id(
            &state.db,
            user.id.as_str(),
            pagination.unread_only,
        )
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let total_installment_notifications =
        db::notifications::count_installment_notifications_by_lender_id(
            &state.db,
            user.id.as_str(),
            pagination.unread_only,
        )
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let total_chat_notifications =
        db::notifications::count_chat_message_notifications_by_lender_id(
            &state.db,
            user.id.as_str(),
            pagination.unread_only,
        )
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let total =
        total_contract_notifications + total_installment_notifications + total_chat_notifications;

    let contract_notifications =
        db::notifications::get_contract_notifications_by_lender_id_paginated(
            &state.db,
            user.id.as_str(),
            pagination.limit,
            pagination.offset(),
            pagination.unread_only,
        )
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let mut notifications = contract_notifications
        .into_iter()
        .map(NotificationMessage::from)
        .collect::<Vec<_>>();

    let installment_notifications =
        db::notifications::get_installment_notifications_by_lender_id_paginated(
            &state.db,
            user.id.as_str(),
            pagination.limit,
            pagination.offset(),
            pagination.unread_only,
        )
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let mut installment_notifications = installment_notifications
        .into_iter()
        .map(NotificationMessage::from)
        .collect::<Vec<_>>();

    notifications.append(&mut installment_notifications);

    let chat_notifications =
        db::notifications::get_chat_message_notifications_by_lender_id_paginated(
            &state.db,
            user.id.as_str(),
            pagination.limit,
            pagination.offset(),
            pagination.unread_only,
        )
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let mut chat_notifications = chat_notifications
        .into_iter()
        .map(NotificationMessage::from)
        .collect::<Vec<_>>();

    notifications.append(&mut chat_notifications);

    // Sort by created_at since we're combining two sources
    notifications.sort_by_key(|b| std::cmp::Reverse(b.timestamp()));

    // Take only the requested number of items
    notifications.truncate(pagination.limit as usize);

    let total_pages = ((total as f64) / (pagination.limit as f64)).ceil() as u32;

    Ok(AppJson(PaginatedResponse {
        data: notifications,
        page: pagination.page,
        limit: pagination.limit,
        total,
        total_pages,
    }))
}

async fn put_mark_as_read(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<AppJson<()>, Error> {
    db::notifications::mark_as_read(&state.db, id)
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    Ok(AppJson(()))
}

async fn put_mark_all_as_read(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> Result<AppJson<()>, Error> {
    db::notifications::mark_all_as_read(&state.db, user.id.as_str())
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    Ok(AppJson(()))
}

async fn notifications_ws(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state, user))
}

async fn handle_socket(socket: WebSocket, app_state: Arc<AppState>, user: Lender) {
    let (mut sender, _) = socket.split();
    // Create a channel for this connection
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Add this connection to our shared state
    {
        app_state
            .notifications
            .websocket
            .add_connection(user.id.clone(), tx)
            .await;
    }

    // Task to send messages to this client
    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sender.send(message).await.is_err() {
                break;
            }
        }
    });

    // Wait for the send task to complete
    if let Err(e) = send_task.await {
        tracing::error!("Error in send task: {:?}", e);
    }

    // Connection closed, remove it from the shared state
    app_state
        .notifications
        .websocket
        .remove_user_connections(&user.id)
        .await;
}

// Error fields are allowed to be dead code because they are actually used when printed in logs.
#[allow(dead_code)]
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(String),
    /// Generally bad request
    BadRequest(String),
}

impl Error {
    fn database(e: anyhow::Error) -> Self {
        Self::Database(format!("{e:#}"))
    }
    fn bad_request(e: anyhow::Error) -> Self {
        Self::BadRequest(format!("{e:#}"))
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
            Error::JsonRejection(rejection) => {
                // This error is caused by bad user input so don't log it
                (rejection.status(), rejection.body_text())
            }
            Error::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::BadRequest(_) => (StatusCode::BAD_REQUEST, "Bad Request".to_owned()),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
