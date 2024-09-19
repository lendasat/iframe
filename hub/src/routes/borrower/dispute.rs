use crate::db;
use crate::email::Email;
use crate::model::DisputeRequestBodySchema;
use crate::model::DisputeStatus;
use crate::model::User;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::borrower::ClaimCollateralPsbt;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use crate::wallet::LIQUIDATOR_ADDRESS;
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
use bitcoin_units::Amount;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use std::sync::Arc;
use time::OffsetDateTime;
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

#[instrument(skip_all, err(Debug), ret)]
pub async fn get_claim_collateral_psbt(
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

        let contract_index = contract
            .contract_index
            .context("Can't generate claim PSBT without contract index")?;
        let collateral_output = contract
            .collateral_output
            .context("Can't generate claim PSBT without collateral output")?;

        let collateral_sats = Amount::from_sat(contract.initial_collateral_sats);
        let collateral_btc = Decimal::try_from(collateral_sats.to_btc()).expect("to fit");
        let initial_price = contract.loan_amount / (collateral_btc * contract.initial_ltv);

        let origination_fee = (contract.loan_amount / initial_price)
            * Decimal::try_from(crate::routes::borrower::contracts::ORIGINATION_FEE_RATE)
                .expect("to fit");
        let origination_fee = origination_fee.round_dp(8);
        let origination_fee =
            Amount::from_btc(origination_fee.to_f64().expect("to fit")).expect("to fit");

        let (psbt, collateral_descriptor) = data.wallet.create_dispute_claim_collateral_psbt(
            contract.borrower_pk,
            contract_index,
            collateral_output,
            collateral_sats.to_sat(),
            [
                (
                    contract.borrower_btc_address,
                    dispute.borrower_payout_sats.expect("To be some") as u64,
                ),
                (
                    LIQUIDATOR_ADDRESS.parse().expect("to be valid"),
                    dispute.borrower_payout_sats.expect("To be some") as u64,
                ),
            ],
            origination_fee.to_sat(),
        )?;

        let psbt = psbt.serialize_hex();

        let res = ClaimCollateralPsbt {
            psbt,
            collateral_descriptor,
        };

        anyhow::Ok(res)
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
