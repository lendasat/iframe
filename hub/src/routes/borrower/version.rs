use crate::routes::borrower::auth::jwt_or_api_auth::auth;
use crate::routes::AppState;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde::Serialize;
use std::sync::Arc;

const VERSION: &str = env!("CARGO_PKG_VERSION");
const GIT_HASH: &str = env!("GIT_HASH");

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/version", get(version))
        .route_layer(middleware::from_fn_with_state(app_state.clone(), auth))
        .with_state(app_state)
}

#[derive(Serialize)]
pub struct Version {
    version: String,
    commit_hash: String,
}

pub async fn version() -> impl IntoResponse {
    Json(Version {
        version: VERSION.to_owned(),
        commit_hash: GIT_HASH.to_owned(),
    })
}
