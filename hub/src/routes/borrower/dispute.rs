use crate::db;
use crate::email::Email;
use crate::mempool;
use crate::model::Borrower;
use crate::model::DisputeRequestBodySchema;
use crate::model::DisputeStatus;
use crate::model::PsbtQueryParams;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::borrower::ClaimCollateralPsbt;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::bail;
use anyhow::Context;
use axum::extract::Path;
use axum::extract::Query;
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
use tracing::instrument;

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
            "/api/disputes/:dispute_id/claim",
            get(get_claim_collateral_psbt).route_layer(middleware::from_fn_with_state(
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
    Extension(user): Extension<Borrower>,
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
    Extension(user): Extension<Borrower>,
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

    let email_instance = Email::new(data.config.clone());
    let user_id = user.id.clone();
    if let Err(error) = email_instance
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

    let email_instance = Email::new(data.config.clone());
    if let Err(error) = email_instance
        .send_notify_admin_about_dispute(
            user,
            dispute.id.as_str(),
            contract.lender_id.as_str(),
            contract.borrower_id.as_str(),
            contract.id.as_str(),
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

#[instrument(skip_all, fields(borrower_id = user.id, contract_id), err(Debug), ret)]
pub async fn get_claim_collateral_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(dispute_id): Path<String>,
    query_params: Query<PsbtQueryParams>,
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

    let dispute = match dispute {
        None => {
            let error_response = ErrorResponse {
                message: "Dispute not found".to_string(),
            };
            return Err((StatusCode::BAD_REQUEST, Json(error_response)));
        }
        Some(dispute) => dispute,
    };

    if dispute.status != DisputeStatus::ResolvedLender
        && dispute.status != DisputeStatus::ResolvedBorrower
    {
        let error_response = ErrorResponse {
            message: "Dispute not yet resolved".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let psbt = async {
        let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
            &data.db,
            dispute.contract_id.as_str(),
            &user.id,
        )
        .await?;

        let psbt = async {
            let contract_index = contract
                .contract_index
                .context("Can't generate claim PSBT without contract index")?;

            let contract_address = contract
                .contract_address
                .context("Cannot claim collateral without collateral address")?;

            let lender_xpub = contract
                .lender_xpub
                .context("Cannot calim collateral without lender xpub")?;

            let collateral_outputs = data
                .mempool
                .send(mempool::GetCollateralOutputs(contract_address))
                .await?;

            if collateral_outputs.is_empty() {
                bail!("Unaware of any collateral outputs to claim");
            }

            let mut wallet = data.wallet.lock().await;
            let (psbt, collateral_descriptor) = wallet.create_dispute_claim_collateral_psbt(
                contract.borrower_pk,
                &lender_xpub,
                contract_index,
                collateral_outputs,
                contract.borrower_btc_address,
                dispute.borrower_payout_sats.expect("To be some") as u64,
                dispute.lender_payout_sats.expect("To be some") as u64,
                contract.origination_fee_sats,
                query_params.fee_rate,
                contract.contract_version,
            )?;

            let txid = psbt.clone().extract_tx_unchecked_fee_rate().compute_txid();
            db::transactions::insert_dispute_txid(&data.db, contract.id.as_str(), &txid).await?;

            let psbt = psbt.serialize_hex();

            let res = ClaimCollateralPsbt {
                psbt,
                collateral_descriptor,
                borrower_pk: contract.borrower_pk,
            };

            anyhow::Ok(res)
        }
        .await?;

        anyhow::Ok(psbt)
    }
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok((StatusCode::OK, Json(psbt)))
}
