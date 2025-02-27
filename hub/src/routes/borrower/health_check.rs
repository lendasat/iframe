use crate::routes::borrower::HEALTH_CHECK_TAG;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router_openapi() -> OpenApiRouter {
    OpenApiRouter::new().routes(routes!(health_checker_handler))
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct Health {
    message: String,
}

/// Shows if server is up and running
#[utoipa::path(
get,
path = "/",
tag = HEALTH_CHECK_TAG,
responses(
    (
        status = 200,
        description = "Shows if server is up and running",
        body = [Health]
    )
)
)]
pub async fn health_checker_handler() -> impl IntoResponse {
    Json(Health {
        message: "Up and running".to_string(),
    })
}
