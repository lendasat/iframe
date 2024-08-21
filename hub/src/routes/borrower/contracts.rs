use crate::db;
use crate::model::ContractRequestSchema;
use crate::model::User;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
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
            "/api/contracts",
            get(get_active_contracts).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts",
            post(post_contract_request).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

pub async fn get_active_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contracts = db::contracts::load_contracts_by_borrower_id(&data.db, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    Ok((StatusCode::OK, Json(contracts)))
}

pub async fn post_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Json(body): Json<ContractRequestSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = db::contracts::insert_contract_request(
        &data.db,
        user.id,
        body.loan_id,
        body.initial_ltv,
        body.initial_collateral_sats,
        body.loan_amount,
        body.duration_months,
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    Ok((StatusCode::OK, Json(contract)))
}
