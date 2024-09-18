use crate::db;
use crate::email::Email;
use crate::model::DisputeRequestBodySchema;
use crate::model::User;
use crate::routes::borrower::auth::jwt_auth;
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
use time::OffsetDateTime;

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
    Extension(user): Extension<User>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let disputes = db::dispute::load_disputes_by_borrower(&data.db, user.id.as_str())
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
    Extension(user): Extension<User>,
    Path(dispute_id): Path<String>,
) -> anyhow::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let dispute = db::dispute::load_disputes_by_borrower_and_dispute_id(
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
    if dispute.is_none() {
        let error_response = ErrorResponse {
            message: "Dispute not found".to_string(),
        };

        return Err((StatusCode::NOT_FOUND, Json(error_response)));
    }
    Ok((StatusCode::OK, Json(dispute)))
}

pub(crate) async fn create_dispute(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
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
    let dispute = db::dispute::load_disputes_by_borrower_and_contract_id(
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
    let dispute = db::dispute::start_new_dispute_borrower(
        &data.db,
        body.contract_id.as_str(),
        user.id.as_str(),
        contract.lender_id.as_str(),
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

    let dispute_details_url = format!(
        "{}/disputes/{}",
        data.config.borrower_frontend_origin.to_owned(),
        dispute.id
    );

    let email_instance = Email::new(user.clone(), dispute_details_url, data.config.clone());
    if let Err(error) = email_instance.send_start_dispute(dispute.id.as_str()).await {
        let user_id = user.id;
        tracing::error!(user_id, "Failed sending dispute email {error:#}");
        let json_error = ErrorResponse {
            message: "Something bad happened while sending the confirmation email".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
    }

    let email_instance = Email::new(
        // values here don't matter
        User {
            id: "".to_string(),
            name: "".to_string(),
            email: "".to_string(),
            password: "".to_string(),
            verified: false,
            verification_code: None,
            invite_code: None,
            password_reset_token: None,
            password_reset_at: None,
            created_at: OffsetDateTime::now_utc(),
            updated_at: OffsetDateTime::now_utc(),
        },
        "".to_string(),
        data.config.clone(),
    );
    if let Err(error) = email_instance
        .send_notify_admin_about_dispute(
            dispute.id.as_str(),
            contract.lender_id.as_str(),
            contract.borrower_id.as_str(),
            contract.id.as_str(),
        )
        .await
    {
        let user_id = user.id;
        tracing::error!(user_id, "Failed sending dispute email {error:#}");
        let json_error = ErrorResponse {
            message: "Something bad happened while sending the confirmation email".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
    }

    Ok(Json(dispute))
}
