use crate::routes::lender::auth::jwt_auth::auth;
use crate::routes::AppState;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde::Serialize;
use std::sync::Arc;

const GIT_TAG: &str = env!("GIT_TAG");
const GIT_HASH: &str = env!("GIT_COMMIT_HASH");

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/version", get(version))
        .route_layer(middleware::from_fn_with_state(app_state.clone(), auth))
        .with_state(app_state)
}

#[derive(Serialize)]
pub struct Version {
    tag: String,
    commit_hash: String,
}

pub async fn version() -> impl IntoResponse {
    Json(Version {
        tag: GIT_TAG.to_owned(),
        commit_hash: GIT_HASH.to_owned(),
    })
}
