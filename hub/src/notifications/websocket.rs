use crate::model::NotificationMessage;
use axum::extract::ws::Message;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::Mutex;
use uuid::Uuid;

const MAX_CONNECTIONS_PER_USER: usize = 5;

#[derive(Clone)]
pub struct NotificationCenter {
    connections: Arc<Mutex<HashMap<String, Vec<Connection>>>>,
}

impl Default for NotificationCenter {
    fn default() -> Self {
        Self::new()
    }
}

impl NotificationCenter {
    fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Add a WS connection for a user.
    ///
    /// # Returns
    ///
    /// Connection ID, for later removal.
    pub(crate) async fn add_connection(
        &self,
        user_id: String,
        sender: UnboundedSender<Message>,
    ) -> Uuid {
        let fd_count_before = Self::get_fd_count();

        let mut guard = self.connections.lock().await;

        self.clean_dead_connections_for_user(&user_id, &mut guard);

        let connections_before = guard.get(&user_id).map_or(0, |v| v.len());

        let user_connections = guard.entry(user_id.clone()).or_insert_with(Vec::new);
        if user_connections.len() >= MAX_CONNECTIONS_PER_USER {
            tracing::warn!(
                target: "notification-ws",
                user_id,
                "User has reached max connections ({MAX_CONNECTIONS_PER_USER}), removing oldest",
            );
            user_connections.remove(0);
        }

        let connection_id = Uuid::new_v4();
        user_connections.push(Connection {
            id: connection_id,
            sender,
        });

        let connections_after = guard.get(&user_id).map_or(0, |v| v.len());
        let fd_count_after = Self::get_fd_count();
        tracing::debug!(
            target: "notification-ws",
            user_id,
            %connection_id,
            connections_before,
            connections_after,
            fd_count_before,
            fd_count_after,
            "WS connection added",
        );

        connection_id
    }

    /// Remove a specific connection.
    pub(crate) async fn remove_connection(&self, user_id: &str, connection_id: Uuid) {
        let fd_count_before = Self::get_fd_count();
        let mut guard = self.connections.lock().await;

        if let Some(connections) = guard.get_mut(user_id) {
            let connections_before = connections.len();
            connections.retain(|conn| conn.id != connection_id);
            let connections_after = connections.len();

            if connections.is_empty() {
                guard.remove(user_id);
            }

            let fd_count_after = Self::get_fd_count();
            tracing::debug!(
                target: "notification-ws",
                user_id,
                %connection_id,
                connections_before,
                connections_after,
                fd_count_before,
                fd_count_after,
                "WS connection removed",
            );
        }
    }

    /// Send a notification to a specific user
    ///
    /// Returns to how many connections a message has been sent
    pub(crate) async fn send_to(
        &self,
        user_id: &str,
        message: NotificationMessage,
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let ws_message = message.to_ws_message()?;
        let mut guard = self.connections.lock().await;

        if let Some(connections) = guard.get_mut(user_id) {
            let mut successful_sends = 0;
            let mut failed_indices = Vec::new();

            for (index, connection) in connections.iter().enumerate() {
                if connection.sender.send(ws_message.clone()).is_ok() {
                    successful_sends += 1;
                } else {
                    failed_indices.push(index);
                }
            }

            // Remove failed connections (in reverse order to maintain indices)
            if !failed_indices.is_empty() {
                let fd_count_before = Self::get_fd_count();
                for &index in failed_indices.iter().rev() {
                    connections.remove(index);
                }

                let fd_count_after = Self::get_fd_count();
                tracing::debug!(
                    target = "notification-ws",
                    user_id,
                    connections_removed = failed_indices.len(),
                    fd_count_before,
                    fd_count_after,
                    "WS dead connections removed during send"
                );
            }

            // Remove user entry if no connections left
            if connections.is_empty() {
                guard.remove(user_id);
            }

            Ok(successful_sends)
        } else {
            Ok(0) // No connections for this user
        }
    }

    /// Clean dead connections for a specific user.
    fn clean_dead_connections_for_user(
        &self,
        user_id: &str,
        guard: &mut tokio::sync::MutexGuard<HashMap<String, Vec<Connection>>>,
    ) {
        if let Some(connections) = guard.get_mut(user_id) {
            connections.retain(|connection| !connection.sender.is_closed());
            if connections.is_empty() {
                guard.remove(user_id);
            }
        }
    }

    /// Helper function to get current file descriptor count
    fn get_fd_count() -> usize {
        std::fs::read_dir("/proc/self/fd")
            .map(|entries| entries.count())
            .unwrap_or(0)
    }
}

impl NotificationMessage {
    /// Convert to WS message.
    fn to_ws_message(&self) -> Result<Message, serde_json::Error> {
        let json = serde_json::to_string(self)?;
        Ok(Message::Text(json))
    }
}

#[derive(Clone, Debug)]
struct Connection {
    id: Uuid,
    sender: UnboundedSender<Message>,
}
