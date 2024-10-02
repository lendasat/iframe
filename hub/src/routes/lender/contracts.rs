use crate::db;
use crate::email::Email;
use crate::mempool::TrackContractFunding;
use crate::model::User;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::Context;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::delete;
use axum::routing::get;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use std::sync::Arc;
use tracing::instrument;

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
            "/api/contracts/:contract_id",
            get(get_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/approve",
            put(put_approve_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/principalgiven",
            put(put_principal_given).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/reject",
            delete(delete_reject_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/repaid",
            put(put_repaid_contract).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[instrument(skip_all, err(Debug))]
pub async fn get_active_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contracts = db::contracts::load_contracts_by_lender_id(&data.db, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    Ok((StatusCode::OK, Json(contracts)))
}
#[instrument(skip_all, err(Debug))]
pub async fn get_contract(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        &data.db,
        contract_id.as_str(),
        user.id.as_str(),
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

#[instrument(skip_all, err(Debug))]
pub async fn put_approve_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    async {
        let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
            &data.db,
            contract_id.as_str(),
            &user.id,
        )
        .await
        .context("Failed to load contract request")?;

        let wallet = data.wallet.lock().await;
        let (contract_address, contract_index) = wallet.contract_address(contract.borrower_pk)?;

        let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
            .await
            .context("Failed loading borrower")?
            .context("Borrower not found")?;

        db::contracts::accept_contract_request(
            &data.db,
            user.id.as_str(),
            contract_id.as_str(),
            contract_address.clone(),
            contract_index,
        )
        .await
        .context("Failed to accept contract request")?;

        data.mempool
            .send(TrackContractFunding {
                contract_id,
                contract_address,
            })
            .await?
            .context("Failed to track accepted contract")?;

        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.borrower_frontend_origin.to_owned(),
            contract.id
        );
        let email = Email::new(data.config.clone());
        // We don't want to fail this upwards because the contract request has been already approved.
        if let Err(err) = email
            .send_loan_request_approved(borrower, loan_url.as_str())
            .await
        {
            tracing::error!("Failed notifying lender {err:#}");
        }

        anyhow::Ok(())
    }
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {e:#}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    Ok(())
}

#[instrument(skip_all, err(Debug))]
pub async fn put_principal_given(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = async {
        let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
            &data.db,
            contract_id.as_str(),
            &user.id,
        )
        .await
        .context("Failed to load contract request")?;

        db::contracts::mark_contract_as_principal_given(&data.db, contract_id.as_str())
            .await
            .context("Failed to mark contract as repaid")?;

        anyhow::Ok(contract)
    }
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    Ok(Json(contract))
}

#[instrument(skip_all, err(Debug))]
pub async fn delete_reject_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    db::contracts::reject_contract_request(&data.db, user.id.as_str(), contract_id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;
    Ok(())
}

#[instrument(skip_all, err(Debug))]
pub async fn put_repaid_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    async {
        let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
            &data.db,
            contract_id.as_str(),
            &user.id,
        )
        .await
        .context("Failed to load contract request")?;

        db::contracts::mark_contract_as_repaid(&data.db, contract.id.as_str())
            .await
            .context("Failed to mark contract as repaid")?;

        anyhow::Ok(())
    }
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {e:#}"),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    Ok(())
}
