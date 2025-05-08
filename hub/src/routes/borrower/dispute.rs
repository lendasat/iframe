use crate::db;
use crate::model::Borrower;
use crate::model::DisputeRequestBodySchema;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::routing::post;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use serde::Deserialize;
use std::sync::Arc;
use tracing::instrument;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/disputes",
            get(get_all_disputes_for_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/disputes",
            post(create_dispute).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/disputes/:dispute_id",
            put(add_message_to_dispute).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/disputes/:dispute_id/resolve",
            put(put_resolve_dispute).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[derive(Deserialize)]
pub struct DisputeQueryParams {
    pub contract_id: String,
}

pub async fn get_all_disputes_for_contract(
    State(data): State<Arc<AppState>>,
    query_params: Query<DisputeQueryParams>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let disputes = db::contract_disputes::get_disputes_with_messages_by_contract(
        &data.db,
        query_params.contract_id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok((StatusCode::OK, Json(disputes)))
}

#[instrument(skip_all, fields(borrower_id = user.id, ?body), ret, err(Debug))]
pub(crate) async fn create_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Json(body): Json<DisputeRequestBodySchema>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
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
    let disputes =
        db::contract_disputes::get_disputes_by_contract(&data.db, body.contract_id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    if disputes.iter().any(|d| {
        d.status == db::contract_disputes::DisputeStatus::DisputeStartedBorrower
            || d.status == db::contract_disputes::DisputeStatus::DisputeStartedLender
            || d.status == db::contract_disputes::DisputeStatus::InProgress
    }) {
        let error_response = ErrorResponse {
            message: "Dispute already in progress".parse().unwrap(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let comment = format!("{}. {}", body.reason, body.comment);
    let dispute = db::contract_disputes::start_dispute_borrower(
        &data.db,
        contract.id.as_str(),
        user.id.as_str(),
        comment.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Failed creating dispute: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    if let Some(ref email) = user.email {
        data.notifications
            .send_start_dispute(
                user.name.as_str(),
                email.as_str(),
                dispute.id.to_string().as_str(),
            )
            .await;
    }

    data.notifications
        .send_notify_admin_about_dispute_borrower(
            user,
            dispute.id.to_string().as_str(),
            contract.lender_id.as_str(),
            contract.borrower_id.as_str(),
            contract.id.as_str(),
        )
        .await;

    Ok(Json(dispute))
}

#[derive(Deserialize, Debug)]
pub struct DisputeMessage {
    message: String,
}

#[instrument(skip_all, fields(borrower_id = user.id, dispute_id), err(Debug), ret)]
pub async fn add_message_to_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(dispute_id): Path<Uuid>,
    Json(body): Json<DisputeMessage>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    db::contract_disputes::add_borrower_message(&data.db, dispute_id, user.id, body.message)
        .await
        .map_err(|err| {
            tracing::error!("Failed adding message to dispute {err:#}");

            let error_response = ErrorResponse {
                message: "Something went wrong".to_string(),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;
    Ok(())
}

#[instrument(skip_all, fields(borrower_id = user.id, dispute_id), err(Debug), ret)]
pub async fn put_resolve_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(dispute_id): Path<Uuid>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let dispute = db::contract_disputes::get_dispute_by_dispute_id(&data.db, dispute_id)
        .await
        .map_err(|err| {
            tracing::error!("Failed adding message to dispute {err:#}");

            let error_response = ErrorResponse {
                message: "Something went wrong".to_string(),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    if dispute.status != db::contract_disputes::DisputeStatus::DisputeStartedBorrower {
        tracing::error!("Dispute was not started by borrower");

        let error_response = ErrorResponse {
            message: "Dispute was not started by you".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    db::contract_disputes::resolve_borrower(&data.db, dispute_id, user.id.as_str())
        .await
        .map_err(|err| {
            tracing::error!("Failed resolve dispute {err:#}");

            let error_response = ErrorResponse {
                message: "Something went wrong".to_string(),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;
    Ok(())
}
