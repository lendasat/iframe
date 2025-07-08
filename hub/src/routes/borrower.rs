use crate::config::Config;
use crate::routes::borrower::auth::jwt_or_api_auth::auth;
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
use axum::middleware;
use loan_applications::EditLoanApplicationRequest;
use loan_applications::LoanApplicationErrorResponse;
use loan_offers::QueryParamLoanType;
use reqwest::Method;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::services::ServeFile;
use utoipa::openapi::security::ApiKey;
use utoipa::openapi::security::ApiKeyValue;
use utoipa::openapi::security::SecurityScheme;
use utoipa::Modify;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

pub(crate) mod api_accounts;
pub(crate) mod api_keys;
pub(crate) mod auth;
pub(crate) mod bringin;
pub(crate) mod contracts;
pub(crate) mod health_check;
pub(crate) mod loan_applications;
pub(crate) mod loan_offers;
pub(crate) mod notification_settings;
pub(crate) mod notifications;
pub(crate) mod profile;
pub(crate) mod version;

mod cards;
mod chat;
mod dispute;

pub use contracts::ClaimCollateralPsbt;
pub use contracts::ClaimTx;
pub use contracts::Contract;

const HEALTH_CHECK_TAG: &str = "health";
const AUTH_TAG: &str = "auth";
const CONTRACTS_TAG: &str = "contracts";
const LOAN_OFFERS_TAG: &str = "loan-offers";
const LOAN_APPLICATIONS_TAG: &str = "loan-applications";
const API_KEYS_TAG: &str = "api-keys";
const API_ACCOUNTS_TAG: &str = "api-accounts";
const VERSION_TAG: &str = "version";
const NOTIFICATION_SETTINGS_TAG: &str = "Notification Settings";
const NOTIFICATIONS_TAG: &str = "Notifications";

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Lendasat Borrower API",
        description = r#"
Interact with the Lendasat server to

- register as a new user;
- manage personal API keys;
- query available loan offers;
- create contract requests; and
- manage open contracts.

## How to get an API key as a regular borrower

For the time being, you will have to ask Lendasat support for an API key.

## How to create borrower API accounts

Lendasat partners can create borrower API accounts, which can be used to integrate Lendasat directly into their own products.
The steps are:

1. Register as a regular user at https://borrow.lendasat.com.
2. Ask Lendasat support to generate a master API key for you, e.g. `las-BTC21`.
3. Create new borrower API accounts using this endpoint:

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

4. The returned borrower API key can then be used to interact with Lendasat's API as a regular borrower.

## Example usage of borrower API key

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
```

"#
    ),
    components(
        schemas(QueryParamLoanType, EditLoanApplicationRequest, LoanApplicationErrorResponse)
    ),
    modifiers(&SecurityAddon),
    tags(
        (
            name = VERSION_TAG, description = "Check API version information.",
        ),
        (
            name = HEALTH_CHECK_TAG, description = "Check if the server is available and what version it is running.",
        ),
        (
            name = API_KEYS_TAG, description = "Manage API keys for your borrower account.",
        ),
        (
            name = API_ACCOUNTS_TAG, description = "Create borrower API accounts.",
        ),
        (
            name = AUTH_TAG, description = "Authenticate with the server.",
        ),
        (
            name = CONTRACTS_TAG, description = "Manage your loan contracts.",
        ),
        (
            name = LOAN_OFFERS_TAG, description = "Review and take loan offers.",
        ),
        (
            name = LOAN_APPLICATIONS_TAG, description = "Create and manage loan applications.",
        ),
        (
            name = NOTIFICATION_SETTINGS_TAG, description = "Manage notifications.",
        )
    ),
)]
struct ApiDoc;

struct SecurityAddon;

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

pub async fn spawn_borrower_server(
    config: Config,
    app_state: Arc<AppState>,
) -> Result<JoinHandle<()>> {
    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest("/api/version", version::router())
        .nest("/api/health", health_check::router())
        .nest("/api/auth", auth::router_openapi(app_state.clone()))
        .nest("/api/offers", loan_offers::router(app_state.clone()))
        .nest("/api/contracts", contracts::router(app_state.clone()))
        .nest("/api/keys", api_keys::router(app_state.clone()))
        .nest(
            "/api/create-api-account",
            api_accounts::router(app_state.clone()),
        )
        .nest(
            "/api/loan-applications",
            loan_applications::router(app_state.clone()),
        )
        .nest(
            "/api/notification-settings",
            notification_settings::router(app_state.clone()),
        )
        .nest(
            "/api/notifications",
            notifications::router(app_state.clone()),
        )
        .split_for_parts();

    let router =
        router.merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", api.clone()));

    let app = router
        .merge(auth::router(app_state.clone()))
        .merge(profile::router(app_state.clone()))
        .merge(chat::router(app_state.clone()))
        .merge(dispute::router(app_state.clone()))
        .merge(price_feed_ws::router(app_state.clone()))
        .merge(
            profiles::router()
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth))
                .with_state(app_state.clone()),
        )
        .merge(cards::router(app_state.clone()))
        .merge(bringin::router(app_state))
        // This is a relative path on the filesystem, which means, when deploying `hub` we will need
        // to have the frontend in this directory. Ideally we would bundle the frontend with
        // the binary, but so far we failed at handling requests which are meant to be handled by
        // the frontend and not by the backend, e.g. `/wallet` should not look up a file/asset on
        // the backend, but be only handled on the client side.
        .fallback_service(
            ServeDir::new("./frontend/apps/borrower/dist")
                .fallback(ServeFile::new("./frontend/apps/borrower/dist/index.html")),
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
            "http://localhost:4202".parse::<HeaderValue>()?,
            "http://localhost:4203".parse::<HeaderValue>()?,
            "http://localhost:4204".parse::<HeaderValue>()?,
        ]);

        #[cfg(not(debug_assertions))]
        let cors = cors.allow_origin([
            "https://borrow.signet.lendasat.com".parse::<HeaderValue>()?,
            "https://borrow.lendasat.com".parse::<HeaderValue>()?,
            "https://borrowsignet.lendasat.com".parse::<HeaderValue>()?,
            "https://popupsignet.lendasat.com".parse::<HeaderValue>()?,
            "https://popup.lendasat.com".parse::<HeaderValue>()?,
            "https://swagger.signet.lendasat.com".parse::<HeaderValue>()?,
            "https://swagger.lendasat.com".parse::<HeaderValue>()?,
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
