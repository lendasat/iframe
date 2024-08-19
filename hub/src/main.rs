use crate::config::Config;
use crate::db::connect_to_db;
use crate::db::run_migration;
use crate::db::sample_query;
use crate::logger::init_tracing;
use anyhow::Result;
use axum::Router;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use tracing::level_filters::LevelFilter;

mod config;
mod db;
mod email;
mod logger;
mod model;
mod routes;

pub struct AppState {
    db: Pool<Postgres>,
    config: Config,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false, true).expect("to work");
    tracing::info!("Hello World");

    let config = Config::init();
    let borrower_listen_address = config.borrower_listen_address.clone();
    let borrower_frontend_origin = config.borrower_frontend_origin.clone();

    let pool = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&pool).await?;
    sample_query(&pool).await?;

    let app_state = Arc::new(AppState { db: pool, config });

    let app = Router::new()
        .merge(routes::health_check::router())
        .merge(routes::auth::router(app_state.clone()))
        .merge(routes::loan_offers::router(app_state.clone()))
        .merge(routes::contracts::router(app_state.clone()))
        .merge(routes::frontend::router());

    tracing::info!(
        "Starting to listen for borrowers on http://{}",
        borrower_frontend_origin
    );
    let listener = tokio::net::TcpListener::bind(borrower_listen_address)
        .await
        .unwrap();
    axum::serve(listener, app).await.unwrap();
    Ok(())
}
