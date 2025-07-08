use crate::routes::AppState;
use axum::extract::ws::Message;
use axum::extract::ws::WebSocket;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::response::IntoResponse;
use futures::SinkExt;
use futures::StreamExt;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

const PRICE_FEED_TAG: &str = "Price Feed";

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(price_feed_websocket_handler))
        .with_state(app_state)
}

/// WebSocket endpoint for real-time price feed updates.
///
/// This endpoint upgrades the HTTP connection to a WebSocket and provides
/// real-time price feed updates to connected clients.
#[utoipa::path(
    get,
    path = "/",
    tag = PRICE_FEED_TAG,
    responses(
        (
            status = 101,
            description = "WebSocket connection established successfully"
        )
    )
)]
async fn price_feed_websocket_handler(
    State(state): State<Arc<AppState>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, app_state: Arc<AppState>) {
    let (mut sender, _) = socket.split();

    // Create a channel for this connection
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Add this connection to our shared state
    app_state.price_feed_ws_connections.lock().await.push(tx);

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
        .price_feed_ws_connections
        .lock()
        .await
        .retain(|tx| !tx.is_closed());
}

pub async fn broadcast_message(
    connections: Arc<Mutex<Vec<mpsc::UnboundedSender<Message>>>>,
    message: Message,
) {
    let mut connections = connections.lock().await;
    connections.retain(|tx| tx.send(message.clone()).is_ok());
}
