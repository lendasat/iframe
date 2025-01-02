use crate::config::Config;
use crate::mempool;
use crate::moon;
use crate::sideshift;
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
mod user_connection_details_middleware;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

pub struct AppState {
    pub db: Pool<Postgres>,
    pub wallet: Arc<Mutex<Wallet>>,
    pub config: Config,
    pub mempool: xtra::Address<mempool::Actor>,
    pub connections: Arc<Mutex<Vec<mpsc::UnboundedSender<Message>>>>,
    pub moon: Arc<moon::Manager>,
    pub sideshift: Arc<sideshift::Shifter>,
}
