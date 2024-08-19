use axum::response::IntoResponse;
use axum::routing::get;
use axum::Json;
use axum::Router;

pub(crate) fn router() -> Router {
    Router::new().route("/api/health", get(health_checker_handler))
}

pub async fn health_checker_handler() -> impl IntoResponse {
    const MESSAGE: &str = "Up and running";

    let json_response = serde_json::json!({
        "status": "success",
        "message": MESSAGE
    });

    Json(json_response)
}
