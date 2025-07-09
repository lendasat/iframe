use crate::config::Config;
use crate::routes::borrower_profiles;
use crate::routes::borrower_profiles::BORROWER_PROFILES_TAG;
use crate::routes::lender::auth::jwt_auth::auth;
use crate::routes::lender_profiles;
use crate::routes::lender_profiles::LENDER_PROFILES_TAG;
use crate::routes::price_feed_ws;
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
use reqwest::Method;
use std::net::SocketAddr;
use std::sync::Arc;
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

pub(crate) mod api_keys;
pub(crate) mod auth;
pub(crate) mod chat;
pub(crate) mod contracts;
pub(crate) mod dispute;
pub(crate) mod health_check;
pub(crate) mod kyc;
pub(crate) mod loan_applications;
pub(crate) mod loan_offers;
pub(crate) mod notification_settings;
pub(crate) mod notifications;
pub(crate) mod profile;
pub(crate) mod version;

const HEALTH_CHECK_TAG: &str = "health";
const AUTH_TAG: &str = "auth";
const CONTRACTS_TAG: &str = "contracts";
const LOAN_OFFERS_TAG: &str = "loan-offers";
const API_KEYS_TAG: &str = "api-keys";
const LOAN_APPLICATIONS_TAG: &str = "loan-applications";
const KYC_TAG: &str = "kyc";
const VERSION_TAG: &str = "version";
const NOTIFICATION_SETTINGS_TAG: &str = "notification-settings";
const CHAT_TAG: &str = "chat";
const PRICE_FEED_TAG: &str = "price-feed";

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Lendasat Lender API",
        description = r#"
Interact with the lendasat server to
- register as a new user;
- manage personal API keys;
- create and manage loan offers;
- review and take loan applications; and
- manage active loan contracts.
        "#
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
            name = AUTH_TAG, description = "Authenticate with the server.",
        ),
        (
            name = LOAN_OFFERS_TAG, description = "Create and manage loan offers.",
        ),
        (
            name = CONTRACTS_TAG, description = "Manage your loan contracts.",
        ),
        (
            name = API_KEYS_TAG, description = "Manage API keys for your lender account.",
        ),
        (
            name = LOAN_APPLICATIONS_TAG, description = "Review and take loan applications.",
        ),
        (
            name = KYC_TAG, description = "Approve or reject KYC applications from borrowers.",
        ),
        (
            name = NOTIFICATION_SETTINGS_TAG, description = "Manage notifications.",
        ),
        (
            name = CHAT_TAG, description = "Chat notifications.",
        ),
        (
            name = PRICE_FEED_TAG, description = "Real-time price feed WebSocket.",
        ),
        (
            name = LENDER_PROFILES_TAG, description = "Public lender profile statistics.",
        ),
        (
            name = BORROWER_PROFILES_TAG, description = "Public borrower profile statistics.",
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

pub async fn spawn_lender_server(
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
            "/api/loan-applications",
            loan_applications::router(app_state.clone()),
        )
        .nest("/api/kyc", kyc::router(app_state.clone()))
        .nest(
            "/api/notification-settings",
            notification_settings::router(app_state.clone()),
        )
        .nest("/api/chat/notification", chat::router(app_state.clone()))
        .nest("/api/pricefeed", price_feed_ws::router(app_state.clone()))
        .nest(
            "/api/profiles/borrowers",
            borrower_profiles::router(app_state.clone())
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth)),
        )
        .nest(
            "/api/profiles/lenders",
            lender_profiles::router(app_state.clone())
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth)),
        )
        .split_for_parts();

    let router =
        router.merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", api.clone()));

    let app = router.merge(auth::router(app_state.clone())).merge(
        profile::router(app_state.clone())
            .merge(dispute::router(app_state.clone()))
            .merge(notifications::router(app_state.clone()))
            .fallback_service(
                ServeDir::new("./frontend/apps/lender/dist")
                    .fallback(ServeFile::new("./frontend/apps/lender/dist/index.html")),
            ),
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
            "https://lend.lendasat.com".parse::<HeaderValue>()?,
            "https://lend.signet.lendasat.com".parse::<HeaderValue>()?,
            "https://lendsignet.lendasat.com".parse::<HeaderValue>()?,
            "https://swagger.signet.lendasat.com".parse::<HeaderValue>()?,
            "https://swagger.lendasat.com".parse::<HeaderValue>()?,
        ]);

        app.layer(cors)
    };

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
