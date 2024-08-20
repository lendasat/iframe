use crate::config::Config;
use crate::routes::AppState;
use axum::Router;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use tokio::task::JoinHandle;

pub(crate) mod auth;
pub(crate) mod contracts;
pub(crate) mod frontend;
pub(crate) mod health_check;
pub(crate) mod loan_offers;

pub async fn spawn_borrower_server(config: Config, db: Pool<Postgres>) -> JoinHandle<()> {
    let app_state = Arc::new(AppState {
        db,
        config: config.clone(),
    });
    let app = Router::new()
        .merge(health_check::router())
        .merge(auth::router(app_state.clone()))
        .merge(loan_offers::router(app_state.clone()))
        .merge(contracts::router(app_state.clone()))
        .merge(frontend::router());

    let listener = tokio::net::TcpListener::bind(&config.borrower_listen_address)
        .await
        .unwrap();

    tokio::task::spawn(async move {
        tracing::info!(
            "Starting to listen for borrowers on {}",
            config.borrower_frontend_origin
        );

        axum::serve(listener, app).await.unwrap();

        tracing::error!("Borrower server stopped");
    })
}
