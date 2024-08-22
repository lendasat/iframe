use crate::config::Config;
use crate::wallet::Wallet;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;

pub mod borrower;
pub mod lender;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

pub struct AppState {
    db: Pool<Postgres>,
    wallet: Arc<Wallet>,
    config: Config,
}
