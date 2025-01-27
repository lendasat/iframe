use crate::db;
use crate::model::DisputeRequestBodySchema;
use crate::model::Lender;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use std::sync::Arc;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/disputes",
            get(get_all_disputes).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/disputes/:dispute_id",
            get(get_disputes_by_id).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/disputes",
            post(create_dispute).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

pub async fn get_all_disputes(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let disputes = db::dispute::load_disputes_by_lender(&data.db, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;
    Ok((StatusCode::OK, Json(disputes)))
}

pub async fn get_disputes_by_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(dispute_id): Path<String>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let disputes = db::dispute::load_disputes_by_lender_and_dispute_id(
        &data.db,
        user.id.as_str(),
        dispute_id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    if disputes.is_none() {
        let error_response = ErrorResponse {
            message: "Dispute not found".to_string(),
        };

        return Err((StatusCode::NOT_FOUND, Json(error_response)));
    }
    Ok((StatusCode::OK, Json(disputes)))
}

pub(crate) async fn create_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Json(body): Json<DisputeRequestBodySchema>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        body.contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    let dispute = db::dispute::load_disputes_by_lender_and_contract_id(
        &data.db,
        user.id.as_str(),
        body.contract_id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let dispute_already_started = !dispute.is_empty();

    if dispute_already_started {
        tracing::warn!(
            borrower_id = user.id,
            contract_id = body.contract_id,
            "There is already a dispute running, we allow multiple disputes for now."
        )
    }

    let comment = format!("{}. {}", body.reason, body.comment);
    let dispute = db::dispute::start_new_dispute_lender(
        &data.db,
        body.contract_id.as_str(),
        contract.borrower_id.as_str(),
        user.id.as_str(),
        comment.as_str(),
        dispute_already_started,
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Failed creating dispute: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let user_id = user.id.clone();
    if let Err(error) = data
        .notifications
        .send_start_dispute(
            user.name().as_str(),
            user.email().as_str(),
            dispute.id.as_str(),
        )
        .await
    {
        tracing::error!(user_id, "Failed sending dispute email {error:#}");
        let json_error = ErrorResponse {
            message: "Something bad happened while sending the confirmation email".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
    }

    Ok(Json(dispute))
}
