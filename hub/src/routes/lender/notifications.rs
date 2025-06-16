use crate::db;
use crate::model::Lender;
use crate::model::NotificationMessage;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
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

async fn get_all_notifications(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Query(pagination): Query<PaginationQuery>,
) -> Result<AppJson<PaginatedResponse<NotificationMessage>>, Error> {
    pagination.validate().map_err(Error::bad_request)?;

    let total_contract_notifications =
        db::notifications::lender::count_contract_notifications_by_lender_id(
            &state.db,
            user.id.as_str(),
            pagination.unread_only,
        )
        .await
        .map_err(Error::database)?;

    let total_installment_notifications =
        db::notifications::lender::count_installment_notifications_by_lender_id(
            &state.db,
            user.id.as_str(),
            pagination.unread_only,
        )
        .await
        .map_err(Error::database)?;

    let total_chat_notifications =
        db::notifications::lender::count_chat_message_notifications_by_lender_id(
            &state.db,
            user.id.as_str(),
            pagination.unread_only,
        )
        .await
        .map_err(Error::database)?;

    let total =
        total_contract_notifications + total_installment_notifications + total_chat_notifications;

    let contract_notifications =
        db::notifications::lender::get_contract_notifications_by_lender_id_paginated(
            &state.db,
            user.id.as_str(),
            pagination.limit,
            pagination.offset(),
            pagination.unread_only,
        )
        .await
        .map_err(Error::database)?;

    let mut notifications = contract_notifications
        .into_iter()
        .map(NotificationMessage::from)
        .collect::<Vec<_>>();

    let installment_notifications =
        db::notifications::lender::get_installment_notifications_by_lender_id_paginated(
            &state.db,
            user.id.as_str(),
            pagination.limit,
            pagination.offset(),
            pagination.unread_only,
        )
        .await
        .map_err(Error::database)?;

    let mut installment_notifications = installment_notifications
        .into_iter()
        .map(NotificationMessage::from)
        .collect::<Vec<_>>();

    notifications.append(&mut installment_notifications);

    let chat_notifications =
        db::notifications::lender::get_chat_message_notifications_by_lender_id_paginated(
            &state.db,
            user.id.as_str(),
            pagination.limit,
            pagination.offset(),
            pagination.unread_only,
        )
        .await
        .map_err(Error::database)?;

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
    db::notifications::lender::mark_as_read(&state.db, id)
        .await
        .map_err(Error::database)?;

    Ok(AppJson(()))
}

async fn put_mark_all_as_read(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> Result<AppJson<()>, Error> {
    db::notifications::lender::mark_all_as_read(&state.db, user.id.as_str())
        .await
        .map_err(Error::database)?;

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
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel();

    let connection_id = app_state
        .notifications
        .websocket
        .add_connection(user.id.clone(), tx)
        .await;

    let send_task = tokio::spawn({
        let user_id = user.id.clone();
        async move {
            while let Some(message) = rx.recv().await {
                if sender.send(message).await.is_err() {
                    tracing::debug!(
                        target: "notification-ws",
                        user_id,
                        %connection_id,
                        "WS send failed"
                    );
                    break;
                }
            }
        }
    });

    let receive_task = tokio::spawn({
        let user_id = user.id.clone();
        async move {
            while let Some(msg) = receiver.next().await {
                match msg {
                    Ok(axum::extract::ws::Message::Close(_)) => {
                        tracing::debug!(
                            target: "notification-ws",
                            user_id,
                            %connection_id,
                            "WS close message received",
                        );
                        break;
                    }
                    Err(e) => {
                        tracing::debug!(
                            target: "notification-ws",
                            user_id,
                            %connection_id,
                            "WS error: {e:?}",
                        );
                        break;
                    }
                    _ => continue,
                }
            }
        }
    });

    tokio::select! {
        result = send_task => {
            if let Err(e) = result {
                tracing::debug!(target: "notification-ws", "Error in send task: {e:?}");
            }
        }
        result = receive_task => {
            if let Err(e) = result {
                tracing::debug!(target: "notification-ws", "Error in receive task: {e:?}");
            }
        }
    }

    app_state
        .notifications
        .websocket
        .remove_connection(&user.id, connection_id)
        .await;
}

#[derive(Debug, Deserialize)]
struct PaginationQuery {
    #[serde(default = "default_page")]
    page: u32,
    #[serde(default = "default_limit")]
    limit: u32,
    #[serde(default = "default_unread_only")]
    unread_only: bool,
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
struct PaginatedResponse<T> {
    data: Vec<T>,
    page: u32,
    limit: u32,
    total: u64,
    total_pages: u32,
}

impl PaginationQuery {
    fn offset(&self) -> u32 {
        (self.page - 1) * self.limit
    }

    fn validate(&self) -> Result<(), &'static str> {
        if self.page == 0 {
            return Err("Page must be greater than 0");
        }
        if self.limit == 0 || self.limit > 100 {
            return Err("Limit must be between 1 and 100");
        }
        Ok(())
    }
}

// Error fields are allowed to be dead code because they are actually used when printed in logs.
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Generally bad request.
    BadRequest(#[allow(dead_code)] String),
}

impl Error {
    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
    }

    fn bad_request(e: impl std::fmt::Display) -> Self {
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
