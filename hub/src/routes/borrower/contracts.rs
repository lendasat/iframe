use crate::db;
use crate::model::User;
use crate::routes::borrower::auth;
use crate::routes::borrower::AppState;
use crate::routes::ErrorResponse;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
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
                auth::jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

pub async fn get_active_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contracts = db::contracts::load_all_contracts_by_borrower_id(&data.db, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })
        .unwrap();

    Ok((StatusCode::OK, Json(contracts)))
}
