use axum::routing::get;
use axum::Router;

pub(crate) fn router() -> Router {
    Router::new().route("/health", get(|| async { "ok" }))
}
