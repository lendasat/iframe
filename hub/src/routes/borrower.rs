use crate::config::Config;
use crate::routes::borrower::auth::jwt_or_api_auth::auth;
use crate::routes::price_feed_ws;
use crate::routes::profiles;
use crate::routes::AppState;
use anyhow::Result;
use axum::body::Body;
use axum::http::header::ACCEPT;
use axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS;
use axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN;
use axum::http::header::AUTHORIZATION;
use axum::http::header::CONTENT_TYPE;
use axum::http::header::ORIGIN;
use axum::http::HeaderValue;
use axum::http::Request;
use axum::http::StatusCode;
use axum::middleware;
use axum::middleware::Next;
use axum::response::Response;
pub use contracts::ClaimCollateralPsbt;
pub use contracts::ClaimTx;
pub use contracts::Contract;
use reqwest::Method;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::services::ServeFile;

pub(crate) mod api_accounts;
pub(crate) mod api_keys;
pub(crate) mod auth;
pub(crate) mod contracts;
pub(crate) mod health_check;
pub(crate) mod loan_applications;
pub(crate) mod loan_offers;
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
const API_ACCOUNTS_TAG: &str = "api-accounts";

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Lendasat Borrower API",
        description = r#"
Interact with the lendasat server to
- register as a new user,
- manage personal api keys,
- query available loan offers
- create a contract request and
- and manage open contracts.

## How to get an API key

To get started with an API key, follow these steps:

1. Sign up a new user under https://borrow.lendasat.com
2. Provide your user id to a Lendasat employee who will generate a master API key for you, e.g. `las-BTC21`
3. Now you can create new sub users. This API will return a new API key for this user
```bash
curl -X POST "http://localhost:7337/api/create-api-account" \
  -H "Content-Type: application/json" \
  -H "x-api-key: las-BTC21" \
  -d '{
    "name": "Satoshi Nakamoto",
    "email": "satoshi@gmx.com",
    "timezone": "America/New_York"
  }' \
  -v | jq .
```

e.g.

```json
{
  "id": "818316da-6cad-41d6-ac82-6a4d1ec91d3b",
  "name": "Satoshi Nakamoto",
  "email": "satoshi@gmx.com",
  "timezone": "America/New_York",
  "api_key": "ldst-acc-1d906625-064b-4c61-bb3a-41d497421e3f"
}
```

4. The newly created user can then use this key e.g. to send a loan request:

```bash
curl -X POST "http://localhost:7337/api/contracts" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ldst-acc-1d906625-064b-4c61-bb3a-41d497421e3f" \
  -v \
  -d '{
    "loan_id": "9c89f12b-3f1a-4320-bf68-be3ce0820dd2",
    "loan_amount": 100,
    "duration_days": 7,
    ...
  }' | jq .
```"#
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
            name = API_ACCOUNTS_TAG, description = "API to create register new users with API keys",
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
            "/api/loans/offer",
            loan_offers::router_openapi(app_state.clone()),
        )
        .nest(
            "/api/contracts",
            contracts::router_openapi(app_state.clone()),
        )
        .nest("/api/keys", api_keys::router_openapi(app_state.clone()))
        .nest(
            "/api/create-api-account",
            api_accounts::router_openapi(app_state.clone()),
        )
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
        .merge(loan_applications::router(app_state.clone()))
        .merge(cards::router(app_state))
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

    let app = {
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
            ]);

        #[cfg(debug_assertions)]
        let cors = cors.allow_origin([
            "http://localhost:4200".parse::<HeaderValue>()?,
            "http://localhost:4201".parse::<HeaderValue>()?,
        ]);

        #[cfg(not(debug_assertions))]
        let cors =
            cors.allow_origin(["https://borrow.signet.lendasat.com".parse::<HeaderValue>()?]);

        app.layer(cors)
            .layer(middleware::from_fn(cors_debug_middleware))
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

async fn cors_debug_middleware(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    tracing::debug!(target : "cors", "=== CORS Debug Middleware ===");
    tracing::debug!(target : "cors", "Request method: {}", req.method());
    tracing::debug!(target : "cors", "Request URI: {}", req.uri());

    // Log all request headers
    for (name, value) in req.headers() {
        tracing::debug!(target : "cors", "Header: {} = {:?}", name, value);
    }

    // Check specific CORS headers
    if let Some(origin) = req.headers().get("origin") {
        tracing::debug!(target : "cors", "Origin: {:?}", origin);
    } else {
        tracing::debug!(target : "cors", "No Origin header");
    }

    if req.method() == "OPTIONS" {
        tracing::debug!(target : "cors", "OPTIONS preflight request detected");

        if let Some(req_method) = req.headers().get("access-control-request-method") {
            tracing::debug!(target : "cors", "Requested method: {:?}", req_method);
        }

        if let Some(req_headers) = req.headers().get("access-control-request-headers") {
            tracing::debug!(target : "cors", "Requested headers: {:?}", req_headers);
        }
    }

    // Process the request through the rest of the middleware stack
    let response = next.run(req).await;

    // Log response status and headers
    tracing::debug!(target : "cors", "Response status: {}", response.status());

    for (name, value) in response.headers() {
        tracing::debug!(target : "cors", "Response header: {} = {:?}", name, value);
    }

    // Check if CORS headers are present in the response
    if let Some(allow_origin) = response.headers().get("access-control-allow-origin") {
        tracing::debug!(target : "cors", "Allow-Origin set to: {:?}", allow_origin);
    } else {
        tracing::error!(
            target : "cors",
            "No Access-Control-Allow-Origin header in response!"
        );
    }

    if let Some(allow_methods) = response.headers().get("access-control-allow-methods") {
        tracing::debug!(target : "cors", "Allow-Methods set to: {:?}", allow_methods);
    }

    if let Some(allow_credentials) = response.headers().get("access-control-allow-credentials") {
        tracing::debug!(
            target : "cors",
            "Allow-Credentials set to: {:?}",
            allow_credentials
        );
    }

    tracing::debug!(target : "cors", "=== End CORS Debug ===");

    Ok(response)
}
