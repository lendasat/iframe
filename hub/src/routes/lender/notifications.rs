use crate::model::Lender;
use crate::notifications::websocket::NotificationMessage;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
use axum::extract::ws::WebSocket;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Extension;
use axum::Router;
use futures::SinkExt;
use futures::StreamExt;
use std::sync::Arc;
use tokio::sync::mpsc;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/notifications",
            get(notifications).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

async fn notifications(
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
            .lender_notification_center
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
        .lender_notification_center
        .remove_user_connections(&user.id)
        .await;
}
