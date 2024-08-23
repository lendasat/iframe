use crate::config::Config;
use crate::routes::AppState;
use axum::http::header::ACCEPT;
use axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS;
use axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN;
use axum::http::header::AUTHORIZATION;
use axum::http::header::CONTENT_TYPE;
use axum::http::header::ORIGIN;
use axum::http::HeaderValue;
use axum::http::Method;
use axum::Router;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tower_http::cors::CorsLayer;

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

    // todo: make this a dev-only setting
    let cors = CorsLayer::new()
        .allow_credentials(true)
        .allow_methods(vec![Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(vec![
            ORIGIN,
            AUTHORIZATION,
            ACCEPT,
            ACCESS_CONTROL_ALLOW_HEADERS,
            ACCESS_CONTROL_ALLOW_ORIGIN,
            CONTENT_TYPE,
        ])
        .allow_origin(["http://localhost:4200".parse::<HeaderValue>().unwrap()]);

    let app = app.layer(cors);

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
