use crate::routes::lender::VERSION_TAG;
use crate::GIT_HASH;
use crate::GIT_TAG;
use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router() -> OpenApiRouter {
    OpenApiRouter::new().routes(routes!(version))
}

#[derive(Serialize, ToSchema)]
struct Version {
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
async fn version() -> Json<Version> {
    Json(Version {
        tag: GIT_TAG.to_owned(),
        commit_hash: GIT_HASH.to_owned(),
    })
}
