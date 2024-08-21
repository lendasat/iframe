use crate::config::Config;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;

pub mod borrower;
pub mod lender;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

pub struct AppState {
    db: Pool<Postgres>,
    config: Config,
}
