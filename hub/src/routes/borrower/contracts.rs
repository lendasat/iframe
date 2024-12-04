use crate::db;
use crate::email::Email;
use crate::mempool;
use crate::model;
use crate::model::ContractRequestSchema;
use crate::model::ContractStatus;
use crate::model::ContractVersion;
use crate::model::Integration;
use crate::model::LiquidationStatus;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanTransaction;
use crate::model::PsbtQueryParams;
use crate::model::User;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::bail;
use anyhow::ensure;
use anyhow::Context;
use anyhow::Result;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::delete;
use axum::routing::get;
use axum::routing::post;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use bitcoin::Amount;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use miniscript::Descriptor;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use time::ext::NumericalDuration;
use time::format_description;
use time::OffsetDateTime;
use tracing::instrument;
use uuid::Uuid;

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
            "/api/contracts/:id",
            post(post_claim_tx).route_layer(middleware::from_fn_with_state(
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
        .route(
            "/api/contracts/:id",
            delete(cancel_contract_request).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:contract_id/repaid",
            put(put_repayment_provided).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/contracts/:id/claim",
            get(get_claim_collateral_psbt).route_layer(middleware::from_fn_with_state(
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
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
    pub status: ContractStatus,
    pub borrower_pk: PublicKey,
    pub borrower_btc_address: String,
    pub borrower_loan_address: String,
    pub contract_address: Option<String>,
    pub loan_repayment_address: String,
    pub lender: LenderProfile,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339::option")]
    pub repaid_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub expiry: OffsetDateTime,
    pub liquidation_status: LiquidationStatus,
    pub transactions: Vec<LoanTransaction>,
    pub integration: Integration,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LenderProfile {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaimCollateralPsbt {
    pub psbt: String,
    pub collateral_descriptor: Descriptor<PublicKey>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaimTx {
    pub tx: String,
}

#[instrument(skip_all, err(Debug))]
pub async fn post_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Json(body): Json<ContractRequestSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = async {
        let offer = db::loan_offers::loan_by_id(&data.db, &body.loan_id)
            .await?
            .context("No loan offer for contract")?;

        let contract_id = Uuid::new_v4();
        let (borrower_loan_address, moon_invoice) = match body.integration {
            Integration::StableCoin => (
                body.borrower_loan_address
                    .context("Must provide a borrower loan address for stable coin integration")?,
                None,
            ),
            Integration::PayWithMoon => {
                ensure!(
                    offer.loan_asset_chain == LoanAssetChain::Polygon
                        && offer.loan_asset_type == LoanAssetType::Usdc,
                    "Pay with Moon only supports USDC on Polygon"
                );

                let cards = db::moon::get_borrower_cards(&data.db, user.id.as_str())
                    .await
                    .context("Could not load from db")?;
                if !cards.is_empty() {
                    bail!("Only one card per user is allowed at the moment");
                }

                let invoice = data
                    .moon
                    .generate_invoice(
                        body.loan_amount,
                        contract_id.to_string(),
                        offer.lender_id,
                        user.id.as_str(),
                    )
                    .await
                    .context("Generate Moon invoice")?;

                (invoice.address.clone(), Some(invoice))
            }
        };

        let price = get_bitmex_index_price(OffsetDateTime::now_utc()).await?;
        let ltv = offer.min_ltv;

        let collateral_btc = (body.loan_amount / ltv) / price;
        let collateral_btc = collateral_btc.round_dp(8);
        let collateral_btc = collateral_btc.to_f64().context("Invalid conversion")?;
        let collateral = Amount::from_btc(collateral_btc)?;

        // TODO: implement a proper filter, for now we only have one fee anyways
        let filter = data
            .config
            .origination_fee
            .first()
            .context("No origination fee variable set")?;

        let origination_fee_btc = (body.loan_amount * filter.fee) / price;
        let origination_fee = origination_fee_btc.round_dp(8);
        let origination_fee =
            Amount::from_btc(origination_fee.to_f64().expect("to fit")).expect("to fit");

        let contract = db::contracts::insert_contract_request(
            &data.db,
            contract_id,
            user.id.as_str(),
            &body.loan_id,
            offer.min_ltv,
            collateral.to_sat(),
            origination_fee.to_sat(),
            body.loan_amount,
            body.duration_months,
            body.borrower_btc_address,
            body.borrower_pk,
            borrower_loan_address.as_str(),
            body.integration,
            ContractVersion::TwoOfThree,
        )
        .await?;

        if let Some(invoice) = moon_invoice {
            data.moon
                .persist_invoice(&invoice)
                .await
                .context("Persist Moon invoice")?;
        }

        let loan_url = format!(
            "{}/my-contracts/{}",
            data.config.lender_frontend_origin.to_owned(),
            contract.id
        );
        let email = Email::new(data.config.clone());

        // We don't want to fail this upwards because the contract request has been sent already.
        if let Err(e) = async {
            let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
                .await?
                .context("Failed to find lender")?;

            email
                .send_new_loan_request(lender, loan_url.as_str())
                .await
                .context("Failed to send loan-request email")?;

            db::contract_emails::mark_loan_request_as_sent(&data.db, &contract.id)
                .await
                .context("Failed to mark loan-request email as sent")?;

            anyhow::Ok(())
        }
        .await
        {
            tracing::error!("Failed at notifying lender about loan request: {e:#}");
        }

        let contract = map_to_api_contract(&data, contract)
            .await
            .map_err(|_| anyhow::anyhow!("Failed to map contract"))?;

        anyhow::Ok(contract)
    }
    .await
    .map_err(|error| {
        // TODO: while convenient to have one big error catch block, it is not ideal to
        // differentiate between different error types
        let error_response = ErrorResponse {
            message: format!("{:#}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok((StatusCode::OK, Json(contract)))
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

    let mut contracts_api = Vec::new();
    for contract in contracts {
        let contract = map_to_api_contract(&data, contract).await?;

        contracts_api.push(contract);
    }

    Ok((StatusCode::OK, Json(contracts_api)))
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

    let contract = map_to_api_contract(&data, contract).await?;

    Ok((StatusCode::OK, Json(contract)))
}

// This API is only needed for the version of the protocol _without_ DLCs. With DLCs, the borrower
// will be able to unilaterally reclaim the collateral after they learn the loan secret.
#[instrument(skip_all, fields(borrower_id = user.id, contract_id), err(Debug), ret)]
pub async fn get_claim_collateral_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
    query_params: Query<PsbtQueryParams>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        &user.id,
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Contract not found: {}", error),
        };
        (StatusCode::BAD_REQUEST, Json(error_response))
    })?;

    if contract.status != ContractStatus::RepaymentConfirmed {
        let error_response = ErrorResponse {
            message: "Contract is not yet repaid".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

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

        let origination_fee = Amount::from_sat(contract.origination_fee_sats);

        let mut wallet = data.wallet.lock().await;

        let (psbt, collateral_descriptor) = wallet.create_claim_collateral_psbt(
            contract.borrower_pk,
            &lender_xpub,
            contract_index,
            collateral_outputs,
            origination_fee.to_sat(),
            contract.borrower_btc_address.assume_checked(),
            query_params.fee_rate,
            contract.contract_version,
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

// We don't need the borrower to publish the claim TX through the hub, but it is convenient to be
// able to move the contract state forward. Eventually we could remove this and publish from the
// borrower client.
#[instrument(skip(data, _user), err(Debug), ret)]
pub async fn post_claim_tx(
    State(data): State<Arc<AppState>>,
    // TODO: Make sure that the claim TX is issued by the _right_ user.
    Extension(_user): Extension<User>,
    Path(contract_id): Path<String>,
    Json(body): Json<ClaimTx>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let txid = async {
        let tx: Transaction = bitcoin::consensus::encode::deserialize_hex(&body.tx)?;
        let claim_txid = tx.compute_txid();

        data.mempool
            .send(mempool::TrackCollateralClaim {
                contract_id: contract_id.clone(),
                claim_txid,
            })
            .await??;

        data.mempool.send(mempool::PostTx(body.tx)).await??;
        db::transactions::insert_claim_txid(&data.db, contract_id.as_str(), &claim_txid).await?;
        db::contracts::mark_contract_as_closing(&data.db, contract_id.as_str()).await?;

        anyhow::Ok(claim_txid)
    }
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok((StatusCode::OK, txid.to_string()))
}

#[instrument(skip(data, user), err(Debug), ret)]
pub async fn cancel_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(contract_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(|e| {
        tracing::error!(
            contract_id,
            borrower_id = user.id,
            "Could not load contract"
        );

        let error_response = ErrorResponse {
            message: format!("Contract not found: {e:#}"),
        };
        (StatusCode::BAD_REQUEST, Json(error_response))
    })?;

    if contract.status != ContractStatus::Requested {
        let error_response = ErrorResponse {
            message: "Can only cancel request if it has not yet been approved".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    db::contracts::mark_contract_as_cancelled(&data.db, contract_id.as_str(), user.id.as_str())
        .await
        .map_err(|e| {
            tracing::error!(
                contract_id,
                borrower_id = user.id,
                "Could not mark contract as cancelled"
            );

            let error_response = ErrorResponse {
                message: format!("Could not cancel request: {e:#}"),
            };
            (StatusCode::BAD_REQUEST, Json(error_response))
        })?;

    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Index {
    #[serde(with = "time::serde::rfc3339")]
    #[serde(rename = "timestamp")]
    _timestamp: OffsetDateTime,
    last_price: f64,
    #[serde(rename = "reference")]
    _reference: String,
}

async fn get_bitmex_index_price(timestamp: OffsetDateTime) -> Result<Decimal> {
    let time_format = format_description::parse("[year]-[month]-[day] [hour]:[minute]")?;

    // Ideally we get the price indicated by `timestamp`, but if it is not available we are happy to
    // take a price up to 1 minute in the past.
    let start_time = (timestamp - 1.minutes()).format(&time_format)?;
    let end_time = timestamp.format(&time_format)?;

    let mut url = reqwest::Url::parse("https://www.bitmex.com/api/v1/instrument/compositeIndex")?;
    // TODO: Are we using the right symbol?
    url.query_pairs_mut()
        .append_pair("symbol", ".BXBT")
        .append_pair(
            "filter",
            // The `reference` is set to `BMI` to get the _composite_ index.

            &format!("{{\"symbol\": \".BXBT\", \"startTime\": \"{start_time}\", \"endTime\": \"{end_time}\", \"reference\": \"BMI\"}}"),
        )
        .append_pair("columns", "lastPrice,timestamp,reference")
        // Reversed to get the latest one.
        .append_pair("reverse", "true")
        // Only need one index.
        .append_pair("count", "1");

    let indices = reqwest::get(url).await?.json::<Vec<Index>>().await?;
    let index = &indices[0];

    let index_price = Decimal::try_from(index.last_price)?;

    Ok(index_price)
}

#[derive(Debug, Deserialize)]
pub struct PrincipalRepaidQueryParam {
    pub txid: String,
}

#[instrument(skip(data, user), err(Debug))]
pub async fn put_repayment_provided(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    query_params: Query<PrincipalRepaidQueryParam>,
    Extension(user): Extension<User>,
) -> std::result::Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    async {
        let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
            &data.db,
            contract_id.as_str(),
            &user.id,
        )
        .await
        .context("Failed to load contract")?;

        db::contracts::mark_contract_as_repayment_provided(&data.db, contract.id.as_str())
            .await
            .context("Failed to mark contract as repaid")?;

        db::transactions::insert_principal_repaid_txid(
            &data.db,
            contract_id.as_str(),
            query_params.txid.as_str(),
        )
        .await
        .context("Failed inserting principal given tx id")?;

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

/// Convert from a [`model::Contract`] to a [`Contract`].
async fn map_to_api_contract(
    data: &Arc<AppState>,
    contract: model::Contract,
) -> Result<Contract, (StatusCode, Json<ErrorResponse>)> {
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

    // TODO: Do this better tomorrow.
    let expiry = contract.created_at + time::Duration::weeks((contract.duration_months * 4) as i64);

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

    let transactions = db::transactions::get_all_for_contract_id(&data.db, contract.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let mut repaid_at = None;
    if contract.status == ContractStatus::Closed || contract.status == ContractStatus::Closing {
        repaid_at = Some(contract.updated_at);
    }

    let contract = Contract {
        id: contract.id,
        loan_amount: contract.loan_amount,
        duration_months: contract.duration_months,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        collateral_sats: contract.collateral_sats,
        interest_rate: offer.interest_rate,
        initial_ltv: contract.initial_ltv,
        loan_asset_type: offer.loan_asset_type,
        loan_asset_chain: offer.loan_asset_chain,
        status: contract.status,
        borrower_pk: contract.borrower_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        loan_repayment_address: offer.loan_repayment_address,
        lender: LenderProfile {
            id: contract.lender_id,
            name: lender.name,
        },
        created_at: contract.created_at,
        updated_at: contract.updated_at,
        repaid_at,
        expiry,
        liquidation_status: contract.liquidation_status,
        transactions,
        integration: contract.integration,
    };

    Ok(contract)
}
