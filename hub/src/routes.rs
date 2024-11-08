use crate::config::Config;
use crate::mempool;
use crate::moon;
use crate::wallet::Wallet;
use axum::extract::ws::Message;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::Mutex;

pub mod borrower;
pub mod lender;
pub mod price_feed_ws;
pub(crate) mod profiles;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

pub struct AppState {
    db: Pool<Postgres>,
    wallet: Arc<Mutex<Wallet>>,
    config: Config,
    mempool: xtra::Address<mempool::Actor>,
    connections: Arc<Mutex<Vec<mpsc::UnboundedSender<Message>>>>,
    moon: moon::Manager,
}
