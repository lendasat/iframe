use crate::config::Config;
use crate::routes::lender::auth::jwt_auth::auth;
use crate::routes::price_feed_ws;
use crate::routes::profiles;
use crate::routes::AppState;
use anyhow::Result;
use axum::http::header::ACCEPT;
use axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS;
use axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN;
use axum::http::header::AUTHORIZATION;
use axum::http::header::CONTENT_TYPE;
use axum::http::header::ORIGIN;
use axum::http::HeaderValue;
use axum::http::Method;
use axum::middleware;
use axum::Router;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::services::ServeFile;

pub(crate) mod auth;
pub(crate) mod contracts;
pub(crate) mod dispute;
pub(crate) mod health_check;
pub(crate) mod loan_offers;
pub(crate) mod loan_requests;
pub(crate) mod profile;

pub(crate) mod version;

pub async fn spawn_lender_server(
    config: Config,
    app_state: Arc<AppState>,
) -> Result<JoinHandle<()>> {
    let app = Router::new().merge(
        health_check::router()
            .merge(auth::router(app_state.clone()))
            .merge(profile::router(app_state.clone()))
            .merge(version::router(app_state.clone()))
            .merge(loan_offers::router(app_state.clone()))
            .merge(contracts::router(app_state.clone()))
            .merge(dispute::router(app_state.clone()))
            .merge(price_feed_ws::router(app_state.clone()))
            .merge(
                profiles::router()
                    .route_layer(middleware::from_fn_with_state(app_state.clone(), auth))
                    .with_state(app_state.clone()),
            )
            .merge(loan_requests::router(app_state))
            .fallback_service(
                ServeDir::new("./frontend-monorepo/dist/apps/lender").fallback(ServeFile::new(
                    "./frontend-monorepo/dist/apps/lender/index.html",
                )),
            ),
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
        .allow_origin(["http://localhost:4201".parse::<HeaderValue>()?]);

    let app = app.layer(cors);

    let listener = tokio::net::TcpListener::bind(&config.lender_listen_address).await?;

    let handle = tokio::task::spawn(async move {
        tracing::info!(
            "Starting to listen for lenders on {}",
            config.lender_frontend_origin
        );

        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .expect("to be able to listen");
    });
    Ok(handle)
}
