use crate::config::Config;
use crate::routes::borrower::auth::jwt_or_api_auth::auth;
use crate::routes::price_feed_ws;
use crate::routes::profiles;
use crate::routes::AppState;
use anyhow::Result;
use axum::middleware;
pub use contracts::ClaimCollateralPsbt;
pub use contracts::ClaimTx;
pub use contracts::Contract;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tower_http::services::ServeDir;
use tower_http::services::ServeFile;

pub(crate) mod api_accounts;
pub(crate) mod api_keys;
pub(crate) mod auth;
pub(crate) mod contracts;
pub(crate) mod health_check;
pub(crate) mod loan_offers;
pub(crate) mod loan_requests;
pub(crate) mod profile;
pub(crate) mod version;

use utoipa::openapi::security::ApiKey;
use utoipa::openapi::security::ApiKeyValue;
use utoipa::openapi::security::SecurityScheme;
use utoipa::Modify;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

mod cards;
mod dispute;

const HEALTH_CHECK_TAG: &str = "health";
const AUTH_TAG: &str = "auth";
const CONTRACTS_TAG: &str = "contracts";
const LOAN_OFFERS_TAG: &str = "loan-offers";
const API_KEYS_TAG: &str = "api-keys";

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Lendasat Borrower API",
        description = "Interact with the lendasat server to \n\
            - register as a new user, \n\
            - manage personal api keys, \n\
            - query available loan offers \n\
            - create a contract request and \n\
            - and manage open contracts."
    ),
    modifiers(&SecurityAddon),
    tags(
        (
            name = HEALTH_CHECK_TAG, description = "Check if the server is available",
        ),
        (
            name = API_KEYS_TAG, description = "API to interact with API keys",
        ),
        (
            name = AUTH_TAG, description = "Authenticate with the server",
        ),
        (
            name = CONTRACTS_TAG, description = "API to interact with contracts",
        ),
        (
            name = LOAN_OFFERS_TAG, description = "API to interact with loan offers",
        )
    ),
)]
struct ApiDoc;

struct SecurityAddon;

pub async fn spawn_borrower_server(
    config: Config,
    app_state: Arc<AppState>,
) -> Result<JoinHandle<()>> {
    impl Modify for SecurityAddon {
        fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
            if let Some(components) = openapi.components.as_mut() {
                components.add_security_scheme(
                    "api_key",
                    SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("x-api-key"))),
                )
            }
        }
    }
    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest("/api/health", health_check::router_openapi())
        .nest("/api/auth", auth::router_openapi(app_state.clone()))
        .nest(
            "/api/offers",
            loan_offers::router_openapi(app_state.clone()),
        )
        .nest(
            "/api/contracts",
            contracts::router_openapi(app_state.clone()),
        )
        .nest("/api/keys", api_keys::router_openapi(app_state.clone()))
        .split_for_parts();

    let router =
        router.merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", api.clone()));

    let app = router
        .merge(auth::router(app_state.clone()))
        .merge(profile::router(app_state.clone()))
        .merge(version::router(app_state.clone()))
        .merge(dispute::router(app_state.clone()))
        .merge(price_feed_ws::router(app_state.clone()))
        .merge(
            profiles::router()
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth))
                .with_state(app_state.clone()),
        )
        .merge(loan_requests::router(app_state.clone()))
        .merge(cards::router(app_state.clone()))
        .merge(api_accounts::router(app_state))
        // This is a relative path on the filesystem, which means, when deploying `hub` we will need
        // to have the frontend in this directory. Ideally we would bundle the frontend with
        // the binary, but so far we failed at handling requests which are meant to be handled by
        // the frontend and not by the backend, e.g. `/wallet` should not look up a file/asset on
        // the backend, but be only handled on the client side.
        .fallback_service(
            ServeDir::new("./frontend-monorepo/apps/borrower/dist").fallback(ServeFile::new(
                "./frontend-monorepo/apps/borrower/dist/index.html",
            )),
        );

    #[cfg(debug_assertions)]
    let app = {
        use axum::http::header::ACCEPT;
        use axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS;
        use axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN;
        use axum::http::header::AUTHORIZATION;
        use axum::http::header::CONTENT_TYPE;
        use axum::http::header::ORIGIN;
        use axum::http::HeaderValue;
        use reqwest::Method;
        use tower_http::cors::CorsLayer;

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
            .allow_origin([
                "http://localhost:4200".parse::<HeaderValue>()?,
                "http://localhost:4201".parse::<HeaderValue>()?,
            ]);

        app.layer(cors)
    };

    let listener = TcpListener::bind(&config.borrower_listen_address).await?;

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
