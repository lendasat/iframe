use crate::config::Config;
use crate::mempool;
use crate::routes::AppState;
use crate::wallet::Wallet;
use anyhow::Result;
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

pub async fn spawn_lender_server(
    config: Config,
    wallet: Arc<Wallet>,
    db: Pool<Postgres>,
    mempool: xtra::Address<mempool::Actor>,
) -> Result<JoinHandle<()>> {
    let app_state = Arc::new(AppState {
        db,
        wallet,
        config: config.clone(),
        mempool,
    });
    let app = Router::new().merge(
        health_check::router()
            .merge(auth::router(app_state.clone()))
            .merge(loan_offers::router(app_state.clone()))
            .merge(contracts::router(app_state.clone()))
            .merge(frontend::router()),
    );

    let listener = tokio::net::TcpListener::bind(&config.lender_listen_address).await?;

    let handle = tokio::task::spawn(async move {
        tracing::info!(
            "Starting to listen for lenders on {}",
            config.lender_frontend_origin
        );

        axum::serve(listener, app)
            .await
            .expect("to be able to listen");
    });
    Ok(handle)
}
