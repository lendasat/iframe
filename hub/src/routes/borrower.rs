use crate::config::Config;
use crate::mempool;
use crate::moon;
use crate::routes::price_feed_ws;
use crate::routes::profiles;
use crate::routes::AppState;
use crate::wallet::Wallet;
use anyhow::Result;
use axum::extract::ws::Message;
use axum::http::header::ACCEPT;
use axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS;
use axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN;
use axum::http::header::AUTHORIZATION;
use axum::http::header::CONTENT_TYPE;
use axum::http::header::ORIGIN;
use axum::http::HeaderValue;
use axum::http::Method;
use axum::Router;
pub use contracts::ClaimCollateralPsbt;
pub use contracts::ClaimTx;
pub use contracts::Contract;
use sqlx::Pool;
use sqlx::Postgres;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::services::ServeFile;

pub(crate) mod auth;
mod cards;
pub(crate) mod contracts;
mod dispute;
pub(crate) mod health_check;
pub(crate) mod loan_offers;
pub(crate) mod loan_requests;
pub(crate) mod version;

pub async fn spawn_borrower_server(
    config: Config,
    wallet: Arc<Mutex<Wallet>>,
    db: Pool<Postgres>,
    mempool: xtra::Address<mempool::Actor>,
    connections: Arc<Mutex<Vec<mpsc::UnboundedSender<Message>>>>,
    moon_client: Arc<moon::Manager>,
) -> Result<JoinHandle<()>> {
    let app_state = Arc::new(AppState {
        db,
        wallet,
        config: config.clone(),
        mempool,
        connections,
        moon: moon_client,
    });

    let app = Router::new()
        .merge(health_check::router())
        .merge(auth::router(app_state.clone()))
        .merge(version::router(app_state.clone()))
        .merge(loan_offers::router(app_state.clone()))
        .merge(contracts::router(app_state.clone()))
        .merge(dispute::router(app_state.clone()))
        .merge(price_feed_ws::router(app_state.clone()))
        .merge(profiles::router(app_state.clone()))
        .merge(loan_requests::router(app_state.clone()))
        .merge(cards::router(app_state))
        // This is a relative path on the filesystem, which means, when deploying `hub` we will need
        // to have the frontend in this directory. Ideally we would bundle the frontend with
        // the binary, but so far we failed at handling requests which are meant to be handled by
        // the frontend and not by the backend, e.g. `/wallet` should not look up a file/asset on
        // the backend, but be only handled on the client side.
        .fallback_service(
            ServeDir::new("./frontend-monorepo/dist/apps/borrower").fallback(ServeFile::new(
                "./frontend-monorepo/dist/apps/borrower/index.html",
            )),
        );

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
        .allow_origin(["http://localhost:4200".parse::<HeaderValue>()?]);

    let app = app.layer(cors);

    let listener = tokio::net::TcpListener::bind(&config.borrower_listen_address).await?;

    Ok(tokio::task::spawn(async move {
        tracing::info!(
            "Starting to listen for borrowers on {}",
            config.borrower_frontend_origin
        );

        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .expect("to be able to listen");

        tracing::error!("Borrower server stopped");
    }))
}
