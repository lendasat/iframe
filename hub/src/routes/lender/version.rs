use crate::routes::lender::VERSION_TAG;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

const GIT_TAG: &str = env!("GIT_TAG");
const GIT_HASH: &str = env!("GIT_COMMIT_HASH");

pub(crate) fn router() -> OpenApiRouter {
    OpenApiRouter::new().routes(routes!(version))
}

#[derive(Serialize, ToSchema)]
pub struct Version {
    tag: String,
    commit_hash: String,
}

/// Return the current git tag and commit hash.
#[utoipa::path(
    get,
    path = "/",
    tag = VERSION_TAG,
    responses(
        (
        status = 200,
        description = "Return the deployed version and commit hash",
        body = Version
        )
    )
)]
pub async fn version() -> impl IntoResponse {
    Json(Version {
        tag: GIT_TAG.to_owned(),
        commit_hash: GIT_HASH.to_owned(),
    })
}
