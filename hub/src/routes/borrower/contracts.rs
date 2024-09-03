use crate::db;
use crate::model::ContractRequestSchema;
use crate::model::ContractStatus;
use crate::model::User;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::Context;
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
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;

#[derive(Debug, Serialize, Deserialize)]
pub struct Contract {
    pub id: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub collateral_sats: u64,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub initial_ltv: Decimal,
    pub status: ContractStatus,
    // TODO: We should persist this first.
    pub borrower_btc_address: String,
    pub borrower_loan_address: String,
    pub contract_address: Option<String>,
    // TODO: We should persist this first.
    pub loan_repayment_address: String,
    pub lender: LenderProfile,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339::option")]
    pub repaid_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub expiry: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LenderProfile {
    id: String,
    name: String,
    rating: Decimal,
    loans: u64,
}

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/contracts",
            get(get_contracts).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id",
            get(get_contract).route_layer(middleware::from_fn_with_state(
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

pub async fn get_contracts(
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

    let mut contracts_2 = Vec::new();
    for contract in contracts {
        let offer = db::loan_offers::loan_by_id(&data.db, contract.loan_id)
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?
            .context("No loan found for contract")
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Illegal state error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

        let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?
            .context("No lender found for contract")
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Illegal state error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

        // TODO: Do this better tomorrow.
        let expiry =
            contract.created_at + time::Duration::weeks((contract.duration_months * 4) as i64);

        let contract = Contract {
            id: contract.id,
            loan_amount: contract.loan_amount,
            collateral_sats: contract.initial_collateral_sats,
            interest_rate: offer.interest_rate,
            initial_ltv: contract.initial_ltv,
            status: contract.status,
            borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
            borrower_loan_address: contract.borrower_loan_address,
            contract_address: contract
                .contract_address
                .map(|c| c.assume_checked().to_string()),
            loan_repayment_address: offer.loan_repayment_address,
            lender: LenderProfile {
                id: contract.lender_id,
                name: lender.name,
                // TODO: Use real data.
                rating: Decimal::ONE_HUNDRED,
                loans: 1_000,
            },
            created_at: contract.created_at,
            repaid_at: None,
            expiry,
        };

        contracts_2.push(contract);
    }

    Ok((StatusCode::OK, Json(contracts_2)))
}

#[instrument(skip(data, user), err(Debug))]
pub async fn get_contract(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let offer = db::loan_offers::loan_by_id(&data.db, contract.loan_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .context("No loan found for contract")
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Illegal state error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .context("No lender found for contract")
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Illegal state error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    // TODO: Do this better tomorrow.
    let expiry = contract.created_at + time::Duration::weeks((contract.duration_months * 4) as i64);

    Ok((
        StatusCode::OK,
        Json(Contract {
            id: contract.id,
            loan_amount: contract.loan_amount,
            collateral_sats: contract.initial_collateral_sats,
            interest_rate: offer.interest_rate,
            initial_ltv: contract.initial_ltv,
            status: contract.status,
            borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
            borrower_loan_address: contract.borrower_loan_address,
            contract_address: contract
                .contract_address
                .map(|c| c.assume_checked().to_string()),
            loan_repayment_address: offer.loan_repayment_address,
            lender: LenderProfile {
                id: contract.lender_id,
                name: lender.name,
                // TODO: Use real data.
                rating: Decimal::ONE_HUNDRED,
                loans: 1_000,
            },
            created_at: contract.created_at,
            repaid_at: None,
            expiry,
        }),
    ))
}

#[instrument(skip_all, err(Debug))]
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
        body.borrower_btc_address,
        body.borrower_pk,
        body.borrower_loan_address,
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
