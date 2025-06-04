use crate::model::NotificationMessage;
use axum::extract::ws::Message;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::Mutex;

impl NotificationMessage {
    /// Convert to WebSocket message
    pub fn to_ws_message(&self) -> Result<Message, serde_json::Error> {
        let json = serde_json::to_string(self)?;
        Ok(Message::Text(json))
    }
}

#[derive(Clone)]
pub struct NotificationCenter {
    connections: Arc<Mutex<HashMap<String, Vec<UnboundedSender<Message>>>>>,
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

    /// Add a connection for a user
    pub async fn add_connection(&self, user_id: String, sender: UnboundedSender<Message>) {
        let mut guard = self.connections.lock().await;
        self.clean_dead_connections_for_user(&user_id, &mut guard);
        // TODO: we should probably limit connections per user
        guard.entry(user_id).or_insert_with(Vec::new).push(sender);
    }

    /// Remove all connections for a user
    pub async fn remove_user_connections(&self, user_id: &str) {
        let mut guard = self.connections.lock().await;
        guard.remove(user_id);
    }

    /// Send a notification to a specific user
    ///
    /// Returns to how many connections a message has been sent
    pub async fn send_to(
        &self,
        user_id: &str,
        message: NotificationMessage,
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let ws_message = message.to_ws_message()?;
        let mut guard = self.connections.lock().await;

        if let Some(senders) = guard.get_mut(user_id) {
            let mut successful_sends = 0;
            let mut failed_indices = Vec::new();

            for (index, sender) in senders.iter().enumerate() {
                if sender.send(ws_message.clone()).is_ok() {
                    successful_sends += 1;
                } else {
                    failed_indices.push(index);
                }
            }

            // Remove failed connections (in reverse order to maintain indices)
            for &index in failed_indices.iter().rev() {
                senders.remove(index);
            }

            // Remove user entry if no connections left
            if senders.is_empty() {
                guard.remove(user_id);
            }

            Ok(successful_sends)
        } else {
            Ok(0) // No connections for this user
        }
    }

    /// Send a notification to multiple users
    pub async fn send_to_many(
        &self,
        user_ids: &[String],
        message: NotificationMessage,
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let mut total_sent = 0;
        for user_id in user_ids {
            total_sent += self.send_to(user_id, message.clone()).await?;
        }
        Ok(total_sent)
    }

    /// Broadcast to all connected users
    pub async fn broadcast(
        &self,
        message: NotificationMessage,
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let guard = self.connections.lock().await;
        let all_lenders: Vec<String> = guard.keys().cloned().collect();

        let all_lenders: &[String] = &all_lenders;
        let total_sent = self.send_to_many(all_lenders, message).await?;

        Ok(total_sent)
    }

    /// Get connection count for a user
    pub async fn get_connection_count(&self, user_id: &str) -> usize {
        let mut guard = self.connections.lock().await;
        self.clean_dead_connections_for_user(user_id, &mut guard);
        guard.get(user_id).map_or(0, |senders| senders.len())
    }

    /// Get total connection count across all users
    pub async fn get_total_connections(&self) -> usize {
        let guard = self.connections.lock().await;
        guard.values().map(|senders| senders.len()).sum()
    }

    /// Clean dead connections for a specific user
    fn clean_dead_connections_for_user(
        &self,
        user_id: &str,
        guard: &mut tokio::sync::MutexGuard<HashMap<String, Vec<UnboundedSender<Message>>>>,
    ) {
        if let Some(senders) = guard.get_mut(user_id) {
            senders.retain(|sender| !sender.is_closed());
            if senders.is_empty() {
                guard.remove(user_id);
            }
        }
    }

    /// Clean all dead connections
    pub async fn cleanup_dead_connections(&self) {
        let mut guard = self.connections.lock().await;
        let mut users_to_remove = Vec::new();

        for (user_id, senders) in guard.iter_mut() {
            senders.retain(|sender| !sender.is_closed());
            if senders.is_empty() {
                users_to_remove.push(user_id.clone());
            }
        }

        for user_id in users_to_remove {
            guard.remove(&user_id);
        }
    }
}
