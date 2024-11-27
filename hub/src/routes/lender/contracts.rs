use crate::db;
use crate::email::Email;
use crate::mempool::TrackContractFunding;
use crate::model::ContractStatus;
use crate::model::Integration;
use crate::model::LiquidationStatus;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanTransaction;
use crate::model::User;
use crate::routes::lender::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::Context;
use axum::extract::Path;
use axum::extract::Query;
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
use bitcoin::bip32::Xpub;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use time::OffsetDateTime;
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
            "/api/contracts/:contract_id/principalconfirmed",
            put(put_confirm_repayment).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Contract {
    pub id: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_months: i32,
    pub initial_collateral_sats: u64,
    pub origination_fee_sats: u64,
    pub collateral_sats: u64,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub initial_ltv: Decimal,
    pub status: ContractStatus,
    pub borrower_pk: PublicKey,
    pub borrower_btc_address: String,
    pub borrower_loan_address: String,
    pub contract_address: Option<String>,
    pub loan_repayment_address: String,
    pub borrower: BorrowerProfile,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339::option")]
    pub repaid_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub expiry: OffsetDateTime,
    pub liquidation_status: LiquidationStatus,
    pub transactions: Vec<LoanTransaction>,
    pub loan_asset_chain: LoanAssetChain,
    pub loan_asset_type: LoanAssetType,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BorrowerProfile {
    pub(crate) id: String,
    pub(crate) name: String,
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

    let mut contracts_2 = Vec::new();
    for contract in contracts {
        let transactions =
            db::transactions::get_all_for_contract_id(&data.db, contract.id.as_str())
                .await
                .map_err(|error| {
                    let error_response = ErrorResponse {
                        message: format!("Database error: {}", error),
                    };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
                })?;

        let offer = db::loan_offers::loan_by_id(&data.db, &contract.loan_id)
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

        let borrower = db::borrowers::get_user_by_id(&data.db, &contract.borrower_id)
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

        let asset_chain = offer.loan_asset_chain;
        let asset_type = offer.loan_asset_type;

        let mut repaid_at = None;
        if contract.status == ContractStatus::Closed || contract.status == ContractStatus::Closing {
            repaid_at = Some(contract.updated_at);
        }

        let contract = Contract {
            collateral_sats: contract.collateral_sats,
            id: contract.id,
            loan_amount: contract.loan_amount,
            duration_months: contract.duration_months,
            initial_collateral_sats: contract.initial_collateral_sats,
            origination_fee_sats: contract.origination_fee_sats,
            interest_rate: offer.interest_rate,
            initial_ltv: contract.initial_ltv,
            status: contract.status,
            liquidation_status: contract.liquidation_status,
            borrower_pk: contract.borrower_pk,
            borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
            borrower_loan_address: contract.borrower_loan_address,
            contract_address: contract
                .contract_address
                .map(|c| c.assume_checked().to_string()),
            loan_repayment_address: offer.loan_repayment_address,
            borrower: BorrowerProfile {
                id: contract.borrower_id,
                name: borrower.name,
            },
            created_at: contract.created_at,
            repaid_at,
            transactions,
            expiry,
            loan_asset_chain: asset_chain,
            loan_asset_type: asset_type,
        };

        contracts_2.push(contract);
    }

    Ok((StatusCode::OK, Json(contracts_2)))
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

    let offer = db::loan_offers::loan_by_id(&data.db, &contract.loan_id)
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

    let transactions = db::transactions::get_all_for_contract_id(&data.db, contract_id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let borrower = db::borrowers::get_user_by_id(&data.db, &contract.borrower_id)
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

    let asset_chain = offer.loan_asset_chain;
    let asset_type = offer.loan_asset_type;

    let mut repaid_at = None;
    if contract.status == ContractStatus::Closed || contract.status == ContractStatus::Closing {
        repaid_at = Some(contract.updated_at);
    }

    let contract = Contract {
        collateral_sats: contract.collateral_sats,
        id: contract.id,
        loan_amount: contract.loan_amount,
        duration_months: contract.duration_months,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        interest_rate: offer.interest_rate,
        initial_ltv: contract.initial_ltv,
        status: contract.status,
        liquidation_status: contract.liquidation_status,
        borrower_pk: contract.borrower_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        loan_repayment_address: offer.loan_repayment_address,
        borrower: BorrowerProfile {
            id: borrower.id,
            name: borrower.name,
        },
        created_at: contract.created_at,
        repaid_at,
        transactions,
        expiry,
        loan_asset_chain: asset_chain,
        loan_asset_type: asset_type,
    };

    Ok((StatusCode::OK, Json(contract)))
}

#[derive(Debug, Deserialize)]
pub struct ApproveQueryParam {
    pub xpub: Xpub,
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_approve_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    query_params: Query<ApproveQueryParam>,
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

        let lender_xpub = query_params.xpub;
        let (contract_address, contract_index) = wallet
            .contract_address(contract.borrower_pk, &lender_xpub)
            .await?;

        let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
            .await
            .context("Failed loading borrower")?
            .context("Borrower not found")?;

        let mut db_tx = data
            .db
            .begin()
            .await
            .context("Failed to start db transaction")?;

        let contract = db::contracts::accept_contract_request(
            &mut db_tx,
            user.id.as_str(),
            contract_id.as_str(),
            contract_address.clone(),
            contract_index,
            lender_xpub,
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

        // We could consider creating the card even earlier, but this is a simple way to only
        // generate a card when the loan is likely to be opened.
        if let Integration::PayWithMoon = contract.integration {
            data.moon
                .create_card(borrower.id.clone(), contract.id.clone())
                .await
                .context("Failed to create borrower Moon card")?;
        }

        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.borrower_frontend_origin.to_owned(),
            contract.id
        );
        let email = Email::new(data.config.clone());
        // We don't want to fail this upwards because the contract request has already been
        // approved.
        if let Err(err) = email
            .send_loan_request_approved(borrower, loan_url.as_str())
            .await
        {
            tracing::error!("Failed notifying lender {err:#}");
        }

        db_tx.commit().await.context("Failed writing to db")?;

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

#[derive(Debug, Deserialize)]
pub struct PrincipalGivenQueryParam {
    pub txid: String,
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_principal_given(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    query_params: Query<PrincipalGivenQueryParam>,
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

        db::transactions::insert_principal_given_txid(
            &data.db,
            contract_id.as_str(),
            query_params.txid.as_str(),
        )
        .await
        .context("Failed inserting principal given tx id")?;

        anyhow::Ok(contract)
    }
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    // We don't want to fail this upwards because the contract request has been already
    // approved.
    if let Err(err) = async {
        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.borrower_frontend_origin.to_owned(),
            contract_id
        );
        let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
            .await?
            .context("Borrower not found")?;

        let email = Email::new(data.config.clone());
        email
            .send_loan_paid_out(borrower, loan_url.as_str())
            .await?;
        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed notifying borrower {err:#}");
    }

    let offer = db::loan_offers::loan_by_id(&data.db, &contract.loan_id)
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

    let transactions = db::transactions::get_all_for_contract_id(&data.db, contract_id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let borrower = db::borrowers::get_user_by_id(&data.db, &contract.borrower_id)
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

    // TODO: Do this better tomorrow. No idea where this comment came from, but I'll leave it 😅
    let expiry = contract.created_at + time::Duration::weeks((contract.duration_months * 4) as i64);

    let asset_chain = offer.loan_asset_chain;
    let asset_type = offer.loan_asset_type;

    let contract = Contract {
        collateral_sats: contract.collateral_sats,
        id: contract.id,
        loan_amount: contract.loan_amount,
        duration_months: contract.duration_months,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        interest_rate: offer.interest_rate,
        initial_ltv: contract.initial_ltv,
        status: contract.status,
        liquidation_status: contract.liquidation_status,
        borrower_pk: contract.borrower_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        loan_repayment_address: offer.loan_repayment_address,
        borrower: BorrowerProfile {
            id: borrower.id,
            name: borrower.name,
        },
        created_at: contract.created_at,
        repaid_at: None,
        transactions,
        expiry,
        loan_asset_chain: asset_chain,
        loan_asset_type: asset_type,
    };

    Ok(Json(contract))
}

#[instrument(skip_all, err(Debug))]
pub async fn delete_reject_contract(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract =
        db::contracts::reject_contract_request(&data.db, user.id.as_str(), contract_id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    // We don't want to fail this upwards because the contract request has been already
    // approved.
    if let Err(err) = async {
        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.borrower_frontend_origin.to_owned(),
            contract_id
        );

        let borrower = db::borrowers::get_user_by_id(&data.db, contract.borrower_id.as_str())
            .await?
            .context("Borrower not found")?;

        let email = Email::new(data.config.clone());
        email
            .send_loan_request_approved(borrower, loan_url.as_str())
            .await?;
        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed notifying borrower {err:#}");
    }

    Ok(())
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_confirm_repayment(
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

        db::contracts::mark_contract_as_repayment_confirmed(&data.db, contract.id.as_str())
            .await
            .context("Failed to confirm contract as repaid")?;

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
