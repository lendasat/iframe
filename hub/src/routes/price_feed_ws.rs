use crate::routes::AppState;
use axum::extract::ws::Message;
use axum::extract::ws::WebSocket;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use futures::SinkExt;
use futures::StreamExt;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::Mutex;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/pricefeed", get(price_feed_websocket_handler))
        .with_state(app_state)
}

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
