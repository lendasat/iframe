use crate::config::Config;
use crate::routes::AppState;
use axum::Router;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use tokio::task::JoinHandle;

pub(crate) mod health_check;

pub async fn spawn_lender_server(config: Config, db: Pool<Postgres>) -> JoinHandle<()> {
    let _app_state = Arc::new(AppState {
        db,
        config: config.clone(),
    });
    let app = Router::new().merge(health_check::router());

    let listener = tokio::net::TcpListener::bind(&config.lender_listen_address)
        .await
        .unwrap();

    tokio::task::spawn(async move {
        tracing::info!(
            "Starting to listen for lenders on {}",
            config.lender_frontend_origin
        );

        axum::serve(listener, app).await.unwrap();
    })
}
