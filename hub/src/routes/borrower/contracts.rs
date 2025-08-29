#![allow(unused_qualifications)]

use crate::approve_contract;
use crate::approve_contract::approve_contract;
use crate::bitmex_index_price_rest::get_bitmex_index_price;
use crate::bringin;
use crate::contract_requests;
use crate::db;
use crate::db::contracts::update_borrower_btc_address;
use crate::discounted_origination_fee;
use crate::mempool;
use crate::model;
use crate::model::compute_outstanding_balance;
use crate::model::compute_total_interest;
use crate::model::generate_installments;
use crate::model::BitcoinInvoice;
use crate::model::BitcoinInvoiceStatus;
use crate::model::Borrower;
use crate::model::ContractRequestSchema;
use crate::model::ContractStatus;
use crate::model::ContractVersion;
use crate::model::Currency;
use crate::model::ExtensionPolicy;
use crate::model::FiatLoanDetails;
use crate::model::FiatLoanDetailsWrapper;
use crate::model::InstallmentPaidRequest;
use crate::model::InstallmentStatus;
use crate::model::LatePenalty;
use crate::model::LiquidationStatus;
use crate::model::LoanAsset;
use crate::model::LoanPayout;
use crate::model::LoanTransaction;
use crate::model::LoanType;
use crate::model::Npub;
use crate::model::OriginationFee;
use crate::model::PsbtQueryParams;
use crate::model::TransactionType;
use crate::moon::MOON_CARD_MAX_BALANCE;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::CONTRACTS_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use crate::user_stats;
use crate::user_stats::LenderStats;
use anyhow::anyhow;
use anyhow::Context;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32::DerivationPath;
use bitcoin::consensus::encode::FromHexError;
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use bitcoin::Txid;
use miniscript::Descriptor;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use std::num::NonZeroU64;
use std::sync::Arc;
use time::ext::NumericalDuration;
use time::OffsetDateTime;
use tracing::instrument;
use url::Url;
use utoipa::IntoParams;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_contracts))
        .routes(routes!(get_contract))
        .routes(routes!(put_borrower_btc_address))
        .routes(routes!(get_claim_collateral_psbt))
        .routes(routes!(get_recover_collateral_psbt))
        .routes(routes!(post_contract_request))
        .routes(routes!(post_claim_tx))
        .routes(routes!(post_recover_tx))
        .routes(routes!(post_extend_contract_request))
        .routes(routes!(put_installment_paid))
        .routes(routes!(put_provide_fiat_loan_details))
        .routes(routes!(cancel_contract_request))
        .routes(routes!(post_generate_btc_invoice))
        .routes(routes!(put_report_btc_payment))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

/// Post a contract request.
///
/// The contract request will be forwarded to the lender.
#[utoipa::path(
post,
request_body = ContractRequestSchema,
path = "/",
tag = CONTRACTS_TAG,
responses(
    (
        status = 200,
        description = "The successfully requested contract",
        body = Contract
    )
),
security(
    (
    "api_key" = []
    )
)
)]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id, body), ret, err(Debug))]
async fn post_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<ContractRequestSchema>,
) -> Result<AppJson<Contract>, Error> {
    if db::jail::is_borrower_jailed(&data.db, user.id.as_str())
        .await
        .map_err(Error::database)?
    {
        tracing::trace!(target : "jail", borrower_id = user.id, "Jailed user tried to access." );
        return Err(Error::UserInJail);
    }

    let offer = db::loan_offers::loan_by_id(&data.db, &body.id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLoanOffer {
            id: body.id.clone(),
        })?;

    let non_zero_duration_days = if offer.is_valid_loan_duration(body.duration_days) {
        match NonZeroU64::new(body.duration_days as u64) {
            Some(duration) => duration,
            None => {
                return Err(Error::ZeroLoanDuration);
            }
        }
    } else {
        return Err(Error::InvalidLoanDuration {
            duration_days: body.duration_days,
            duration_days_min: offer.duration_days_min,
            duration_days_max: offer.duration_days_max,
        });
    };

    let loan_amount = body.loan_amount.round_dp(2);

    if !offer.is_valid_loan_amount(loan_amount) {
        return Err(Error::InvalidLoanAmount {
            amount: loan_amount,
            loan_amount_min: offer.loan_amount_min,
            loan_amount_max: offer.loan_amount_max,
        });
    }

    let now = OffsetDateTime::now_utc();

    let contract_id = Uuid::new_v4();
    let lender_id = &offer.lender_id;

    // TODO: Start a DB transaction. As you try to implement this, you discover that this is
    // "impossible" because of https://github.com/launchbadge/sqlx/issues/699. Perhaps we should
    // wrap the `Pool<Postgres>` like in
    // https://github.com/launchbadge/sqlx/issues/699#issuecomment-2371040481.

    let is_kyc_required = offer.requires_kyc();

    if is_kyc_required {
        db::kyc::insert(&data.db, lender_id, &user.id)
            .await
            .map_err(Error::database)?;
    }

    let (borrower_loan_address, moon_invoice, fiat_loan_details, late_penalty) =
        match body.loan_type {
            LoanType::StableCoin => match offer.loan_payout {
                LoanPayout::Direct => match body.borrower_loan_address {
                    Some(borrower_loan_address) => (
                        Some(borrower_loan_address),
                        None,
                        None,
                        LatePenalty::FullLiquidation,
                    ),
                    None => return Err(Error::MissingBorrowerLoanAddress),
                },
                LoanPayout::Indirect => (None, None, None, LatePenalty::FullLiquidation),
                LoanPayout::MoonCardInstant => {
                    return Err(Error::InvalidStableCoinLoanPayout {
                        actual_payout: offer.loan_payout,
                    });
                }
            },
            LoanType::PayWithMoon | LoanType::MoonCardInstant => {
                if offer.loan_asset != LoanAsset::UsdcPol {
                    return Err(Error::InvalidMoonLoanRequest {
                        asset: offer.loan_asset,
                    });
                }

                let late_penalty = if body.loan_type == LoanType::PayWithMoon {
                    if offer.loan_payout != LoanPayout::Direct {
                        return Err(Error::InvalidPayWithMoonPayout {
                            actual_payout: offer.loan_payout,
                        });
                    }

                    LatePenalty::FullLiquidation
                } else {
                    if offer.loan_payout != LoanPayout::MoonCardInstant {
                        return Err(Error::InvalidMoonCardInstantPayout {
                            actual_payout: offer.loan_payout,
                        });
                    }

                    LatePenalty::InstallmentRestructure
                };

                let card_id = match body.moon_card_id {
                    // This is a top-up.
                    Some(card_id) => {
                        let card = db::moon::get_card_by_id(&data.db, &card_id.to_string())
                            .await
                            .map_err(Error::database)?
                            .ok_or(Error::CannotTopUpNonexistentCard)?;

                        let current_balance = card.balance;
                        if current_balance + loan_amount > MOON_CARD_MAX_BALANCE {
                            return Err(Error::CannotTopUpOverLimit {
                                current_balance,
                                loan_amount,
                                limit: MOON_CARD_MAX_BALANCE,
                            });
                        }

                        let client_ip = connection_details
                            .ip
                            .ok_or(Error::CannotTopUpMoonCardWithoutIp)?;

                        let is_us_ip = crate::geo_location::is_us_ip(&client_ip)
                            .await
                            .map_err(Error::geo_js)?;

                        if is_us_ip {
                            return Err(Error::CannotTopUpMoonCardFromUs);
                        } else {
                            card_id
                        }
                    }
                    // This is a new card.
                    None => {
                        let card = data
                            .moon
                            .create_card(user.id.clone())
                            .await
                            .map_err(Error::moon_card_generation)?;

                        card.id
                    }
                };

                let invoice = data
                    .moon
                    .generate_invoice(
                        loan_amount,
                        contract_id.to_string(),
                        card_id,
                        &user.id,
                        crate::moon::Currency::UsdcPolygon,
                        Decimal::ZERO,
                    )
                    .await
                    .map_err(Error::moon_invoice_generation)?;

                (
                    Some(invoice.address.clone()),
                    Some(invoice),
                    None,
                    late_penalty,
                )
            }
            LoanType::Fiat => {
                if !offer.loan_asset.is_fiat() {
                    return Err(Error::FiatLoanWithoutFiatAsset {
                        asset: offer.loan_asset,
                    });
                }

                let fiat_loan_details = body
                    .fiat_loan_details
                    .ok_or(Error::MissingFiatLoanDetails)?;

                (
                    None,
                    None,
                    Some(fiat_loan_details),
                    LatePenalty::FullLiquidation,
                )
            }
            LoanType::Bringin => {
                let ip_address = connection_details
                    .ip
                    .ok_or_else(|| Error::CannotUseBringinWithoutIp)?;

                let address = bringin::get_address(
                    &data.db,
                    &data.config.bringin_url,
                    offer.loan_asset,
                    &user.id,
                    &ip_address,
                    loan_amount,
                )
                .await
                .map_err(Error::from)?;

                (Some(address), None, None, LatePenalty::FullLiquidation)
            }
        };

    let initial_price = get_bitmex_index_price(&data.config, now, offer.loan_asset)
        .await
        .map_err(Error::bitmex_price)?;

    let min_ltv = offer.min_ltv;

    // TODO: Choose origination fee based on loan parameters. For now we only have one origination
    // fee anyway.
    let origination_fee = data
        .config
        .origination_fee
        .first()
        .ok_or(Error::MissingOriginationFee)?;

    // If the user has a discount code, we reduce the origination fee for them.
    let origination_fee_rate =
        discounted_origination_fee::calculate_discounted_origination_fee_rate(
            &data.db,
            origination_fee.fee,
            &user.id,
        )
        .await
        .map_err(Error::from)?;

    let origination_fee_amount = contract_requests::calculate_origination_fee(
        loan_amount,
        origination_fee_rate,
        initial_price,
    )
    .map_err(Error::origination_fee_calculation)?;

    let initial_collateral = contract_requests::calculate_initial_funding_amount(
        loan_amount,
        offer.interest_rate,
        body.duration_days as u32,
        min_ltv,
        initial_price,
        origination_fee_amount,
    )
    .map_err(Error::currency_conversion)?;

    let borrower_npub = body.borrower_npub.unwrap_or(data.config.fallback_npub);

    let contract = db::contracts::insert_new_contract_request(
        &data.db,
        contract_id,
        &user.id,
        lender_id,
        &body.id,
        min_ltv,
        initial_collateral.to_sat(),
        origination_fee_amount.to_sat(),
        loan_amount,
        body.duration_days,
        body.borrower_pk,
        body.borrower_derivation_path,
        offer.lender_pk,
        offer.lender_derivation_path,
        body.borrower_btc_address,
        offer.loan_repayment_address,
        offer.btc_loan_repayment_address.map(|a| a.to_string()),
        borrower_loan_address.as_deref(),
        body.loan_type,
        ContractVersion::TwoOfThree,
        offer.interest_rate,
        borrower_npub,
        offer.lender_npub,
        body.client_contract_id,
        // The contract inherits the extension policy of the loan offer.
        offer.extension_policy,
        offer.loan_asset,
    )
    .await
    .map_err(Error::database)?;

    let installments = {
        let interest_rate = match offer.loan_payout {
            LoanPayout::Direct | LoanPayout::Indirect => offer.interest_rate,
            // These loans are 0-interest if they are repaid before 30 days pass.
            LoanPayout::MoonCardInstant => Decimal::ZERO,
        };

        generate_installments(
            now,
            contract_id,
            offer.repayment_plan,
            non_zero_duration_days,
            interest_rate,
            loan_amount,
            late_penalty,
        )
    };

    db::installments::insert(&data.db, installments)
        .await
        .map_err(Error::database)?;

    if let Some(fiat_loan_details) = fiat_loan_details {
        if fiat_loan_details.details.swift_transfer_details.is_none()
            && fiat_loan_details.details.iban_transfer_details.is_none()
        {
            return Err(Error::MissingFiatLoanDetails);
        }

        db::fiat_loan_details::insert_borrower(
            &data.db,
            &contract_id.to_string(),
            fiat_loan_details,
        )
        .await
        .map_err(Error::database)?;
    }

    let mut contract = map_to_api_contract(&data, contract).await?;

    if let Some(invoice) = moon_invoice {
        data.moon
            .persist_invoice(&invoice)
            .await
            .map_err(Error::database)?;
    }

    // We cannot auto-accept contracts if:
    //
    // - KYC is required; or
    // - The loan asset is fiat.
    if offer.auto_accept && (!is_kyc_required && !offer.loan_asset.is_fiat()) {
        let db_contract = approve_contract(
            &data.db,
            &data.wallet,
            &data.mempool,
            &data.config,
            data.electrum.as_ref(),
            contract.id.clone(),
            lender_id,
            data.notifications.clone(),
            None,
        )
        .await
        .map_err(Error::from)?;
        contract = map_to_api_contract(&data, db_contract).await?;
    }

    let lender_loan_url = data
        .config
        .lender_frontend_origin
        .join(&format!("/my-contracts/{}", contract.id))
        .expect("to be a correct URL");

    // We don't want to fail this upwards because the contract request has been sent already.
    if let Err(e) = async {
        let lender = db::lenders::get_user_by_id(&data.db, &contract.lender.id)
            .await?
            .context("Failed to find lender")?;

        let lender_id = lender.id.clone();
        let borrower_id = user.id.clone();
        if offer.auto_accept {
            data.notifications
                .send_notification_about_auto_accepted_loan(
                    lender,
                    lender_loan_url,
                    contract.id.as_str(),
                )
                .await;

            tracing::info!(
                contract_id = contract_id.to_string(),
                borrower_id,
                lender_id,
                "Contract request has been automatically approved"
            );
        } else {
            data.notifications
                .send_new_loan_request(lender, lender_loan_url, contract.id.as_str())
                .await;

            tracing::info!(
                contract_id = contract_id.to_string(),
                borrower_id,
                lender_id,
                "Contract request notification sent"
            );
        }

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying lender about loan request: {e:#}");
    }

    Ok(AppJson(contract))
}

/// Cancel a contract request.
#[utoipa::path(
delete,
path = "/{id}",
tag = CONTRACTS_TAG,
params(
    (
    "id" = String, Path, description = "Contract ID"
    )
),
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "If OK HTTP 200 is returned",
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id), ret, err(Debug))]
async fn cancel_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    if contract.status != ContractStatus::Requested && contract.status != ContractStatus::Approved {
        return Err(Error::InvalidCancelRequest {
            status: contract.status,
        });
    }

    let mut db_tx = data
        .db
        .begin()
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    db::contracts::mark_contract_as_cancelled(&mut *db_tx, &contract_id)
        .await
        .map_err(Error::database)?;

    db_tx
        .commit()
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    Ok(())
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SortField {
    CreatedAt,
    LoanAmount,
    ExpiryDate,
    InterestRate,
    Status,
    CollateralSats,
    UpdatedAt,
}

impl Default for SortField {
    fn default() -> Self {
        Self::CreatedAt
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

impl Default for SortOrder {
    fn default() -> Self {
        Self::Desc
    }
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ContractsQuery {
    #[serde(default = "default_page")]
    page: u32,
    #[serde(default = "default_limit")]
    limit: u32,
    /// Filter contracts by status. Can be provided multiple times to filter by multiple statuses.
    /// Example: ?status=Requested,Approved
    #[serde(default, with = "serde_qs::helpers::comma_separated")]
    status: Vec<ContractStatus>,
    /// Sort field for ordering results. Default is 'created_at'.
    #[serde(default)]
    sort_by: SortField,
    /// Sort order. Default is 'desc' (newest first).
    #[serde(default)]
    sort_order: SortOrder,
}

fn default_page() -> u32 {
    1
}

fn default_limit() -> u32 {
    10
}

impl SortField {
    fn to_sql_column(&self) -> &'static str {
        match self {
            SortField::CreatedAt => "created_at",
            SortField::LoanAmount => "loan_amount",
            SortField::ExpiryDate => "expiry_date",
            SortField::InterestRate => "interest_rate",
            SortField::Status => "status",
            SortField::CollateralSats => "collateral_sats",
            SortField::UpdatedAt => "updated_at",
        }
    }
}

impl SortOrder {
    fn to_sql(&self) -> &'static str {
        match self {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        }
    }
}

impl ContractsQuery {
    fn offset(&self) -> u32 {
        (self.page - 1) * self.limit
    }

    fn validate(&self) -> Result<(), &'static str> {
        if self.page == 0 {
            return Err("Page must be greater than 0");
        }
        if self.limit == 0 || self.limit > 100 {
            return Err("Limit must be between 1 and 100");
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, ToSchema)]
struct PaginatedContractsResponse {
    data: Vec<Contract>,
    page: u32,
    limit: u32,
    total: u64,
    total_pages: u32,
}

/// Get all personal contracts with pagination, status filtering, and sorting support.
#[utoipa::path(
get,
path = "/",
tag = CONTRACTS_TAG,
params(
    ContractsQuery
),
responses(
    (
    status = 200,
    description = "Paginated list of contracts, optionally filtered by status and sorted by specified field",
    body = PaginatedContractsResponse
    ),
    (
    status = 400,
    description = "Bad request (invalid pagination parameters)"
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, page = query.page, limit = query.limit, statuses = ?query.status, sort_by = ?query.sort_by, sort_order = ?query.sort_order
), err(Debug))]
async fn get_contracts(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Query(query): Query<ContractsQuery>,
) -> Result<AppJson<PaginatedContractsResponse>, Error> {
    if db::jail::is_borrower_jailed(&data.db, user.id.as_str())
        .await
        .map_err(Error::database)?
    {
        tracing::trace!(target : "jail", borrower_id = user.id, "Jailed user tried to access." );
        return Ok(AppJson(PaginatedContractsResponse {
            data: vec![],
            page: 0,
            limit: 0,
            total: 0,
            total_pages: 0,
        }));
    }

    query
        .validate()
        .map_err(|e| Error::bad_request(anyhow!(e)))?;

    let sort_options = db::contracts::SortOptions {
        field: query.sort_by.to_sql_column().to_string(),
        order: query.sort_order.to_sql().to_string(),
    };

    let total = if query.status.is_empty() {
        db::contracts::count_contracts_by_borrower_id(&data.db, &user.id)
            .await
            .map_err(Error::database)?
    } else {
        db::contracts::count_contracts_by_borrower_id_and_statuses(
            &data.db,
            &user.id,
            &query.status,
        )
        .await
        .map_err(Error::database)?
    };

    let contracts = if query.status.is_empty() {
        db::contracts::load_contracts_by_borrower_id_paginated_with_sort(
            &data.db,
            &user.id,
            query.limit,
            query.offset(),
            &sort_options,
        )
        .await
        .map_err(Error::database)?
    } else {
        db::contracts::load_contracts_by_borrower_id_and_statuses_paginated_with_sort(
            &data.db,
            &user.id,
            &query.status,
            query.limit,
            query.offset(),
            &sort_options,
        )
        .await
        .map_err(Error::database)?
    };

    let mut contracts_api = Vec::new();
    for contract in contracts {
        let contract = map_to_api_contract(&data, contract).await?;
        contracts_api.push(contract);
    }

    let total_pages = ((total as f64) / (query.limit as f64)).ceil() as u32;

    Ok(AppJson(PaginatedContractsResponse {
        data: contracts_api,
        page: query.page,
        limit: query.limit,
        total,
        total_pages,
    }))
}

/// Get a specific personal contract.
#[utoipa::path(
get,
path = "/{id}",
params(
    (
    "id" = String, Path, description = "Contract ID"
    )
),
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "If present, the contract details",
    body = Contract
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id), err(Debug))]
async fn get_contract(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
) -> Result<AppJson<Contract>, Error> {
    if db::jail::is_borrower_jailed(&data.db, user.id.as_str())
        .await
        .map_err(Error::database)?
    {
        tracing::trace!(target : "jail", borrower_id = user.id, "Jailed user tried to access." );
        return Err(Error::UserInJail);
    }

    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    let contract = map_to_api_contract(&data, contract).await?;

    Ok(AppJson(contract))
}

/// Mark an installment as paid.
#[utoipa::path(
put,
path = "/{id}/installment-paid",
params(
    (
    "id" = String, Path, description = "Contract ID"
    )
),
    request_body = InstallmentPaidRequest,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(
    skip_all,
    fields(
        borrower_id = %user.id,
        contract_id = %contract_id,
        installment_id = %body.installment_id,
        payment_id = %body.payment_id
    ),
    ret,
    err(Debug)
)]
async fn put_installment_paid(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Borrower>,
    AppJson(body): AppJson<InstallmentPaidRequest>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    db::installments::mark_as_paid(&data.db, body.installment_id, &body.payment_id)
        .await
        .map_err(Error::database)?;

    db::transactions::insert_installment_paid_txid(&data.db, &contract_id, &body.payment_id)
        .await
        .map_err(Error::database)?;

    let installments =
        db::installments::get_all_for_contract_id(&data.db, &contract_id.to_string())
            .await
            .map_err(Error::database)?;

    let is_repayment_provided = !installments.is_empty()
        && installments.iter().all(|i| {
            matches!(
                i.status,
                InstallmentStatus::Cancelled
                    | InstallmentStatus::Paid
                    | InstallmentStatus::Confirmed
            )
        });

    if is_repayment_provided {
        db::contracts::mark_contract_as_repayment_provided(&data.db, &contract_id)
            .await
            .map_err(Error::database)?;
    }

    let loan_url = data
        .config
        .lender_frontend_origin
        .join(&format!("/my-contracts/{}", contract.id))
        .expect("to be valid url");

    if let Err(e) = async {
        let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
            .await?
            .context("Failed to find lender")?;

        data.notifications
            .send_installment_paid(lender, loan_url, body.installment_id, contract_id.as_str())
            .await;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying lender about loan repayment: {e:#}");
    }

    Ok(())
}

/// Provide fiat details to the contract.
#[utoipa::path(
put,
path = "/{id}/fiat-details",
params(
    (
    "id" = String, Path, description = "Contract ID"
    )
),
request_body = FiatLoanDetailsWrapper,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id), ret, err(Debug))]
async fn put_provide_fiat_loan_details(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Borrower>,
    AppJson(body): AppJson<FiatLoanDetailsWrapper>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    db::fiat_loan_details::insert_borrower(&data.db, &contract.id, body)
        .await
        .map_err(Error::database)?;

    Ok(())
}

/// Get a claim-collateral PSBT, to be completed with your own signature on the collateral contract.
///
/// The collateral can be claimed when the Lendasat server and the lender have confirmed that the
/// borrower has repaid the loan.
#[utoipa::path(
get,
path = "/{id}/claim",
params(
    (
    "id" = String, Path, description = "Contract ID"
    ),
    PsbtQueryParams,
),
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    body = SpendCollateralPsbt,
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(
    skip_all,
    fields(borrower_id = user.id, contract_id, fee_rate = query_params.fee_rate),
    ret,
    err(Debug)
)]
async fn get_claim_collateral_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    query_params: Query<PsbtQueryParams>,
) -> Result<AppJson<SpendCollateralPsbt>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    let installments = db::installments::get_all_for_contract_id(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    if compute_outstanding_balance(&installments).total() > Decimal::ZERO {
        return Err(Error::LoanNotRepaid);
    }

    let contract_index = contract.contract_index.ok_or(Error::MissingContractIndex)?;

    let contract_address = contract
        .contract_address
        .ok_or(Error::MissingCollateralAddress)?;

    let collateral_outputs = data
        .mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        return Err(Error::MissingCollateralOutputs);
    }

    let origination_fee = Amount::from_sat(contract.origination_fee_sats);

    let (psbt, collateral_descriptor) = data
        .wallet
        .create_claim_collateral_psbt(
            contract.borrower_pk,
            contract.lender_pk,
            contract_index,
            collateral_outputs,
            origination_fee,
            contract.borrower_btc_address.assume_checked(),
            query_params.fee_rate,
            contract.contract_version,
        )
        .map_err(Error::create_claim_collateral_psbt)?;

    let psbt = psbt.serialize_hex();

    let res = SpendCollateralPsbt {
        psbt,
        collateral_descriptor,
        borrower_pk: contract.borrower_pk,
    };

    Ok(AppJson(res))
}

/// Get a recover-collateral PSBT, to be completed with your own signature on the collateral
/// contract.
///
/// The collateral can be recovered when the Lendasat server has deemed that the lender will not
/// disburse the principal.
#[utoipa::path(
get,
path = "/{id}/recover",
params(
    (
    "id" = String, Path, description = "Contract ID"
    ),
    PsbtQueryParams,
),
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    body = SpendCollateralPsbt,
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(
    skip_all,
    fields(borrower_id = user.id, contract_id, fee_rate = query_params.fee_rate),
    ret,
    err(Debug)
)]
async fn get_recover_collateral_psbt(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    query_params: Query<PsbtQueryParams>,
) -> Result<AppJson<SpendCollateralPsbt>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    // Only allow collateral recovery if the contract is in the `CollateralRecoverable` state.
    if contract.status != ContractStatus::CollateralRecoverable {
        return Err(Error::InvalidRecoveryRequest {
            status: contract.status,
        });
    }

    let contract_index = contract.contract_index.ok_or(Error::MissingContractIndex)?;

    let contract_address = contract
        .contract_address
        .ok_or(Error::MissingCollateralAddress)?;

    let collateral_outputs = data
        .mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        return Err(Error::MissingCollateralOutputs);
    }

    // We do not collect an origination fee for a contract that was never open.
    let origination_fee = Amount::ZERO;

    let (psbt, collateral_descriptor) = data
        .wallet
        .create_claim_collateral_psbt(
            contract.borrower_pk,
            contract.lender_pk,
            contract_index,
            collateral_outputs,
            origination_fee,
            contract.borrower_btc_address.assume_checked(),
            query_params.fee_rate,
            contract.contract_version,
        )
        .map_err(Error::create_claim_collateral_psbt)?;

    let psbt = psbt.serialize_hex();

    let res = SpendCollateralPsbt {
        psbt,
        collateral_descriptor,
        borrower_pk: contract.borrower_pk,
    };

    Ok(AppJson(res))
}

/// Broadcast claim-collateral transaction.
#[utoipa::path(
post,
path = "/{id}/broadcast-claim",
params(
    (
    "id" = String, Path, description = "Contract ID"
    )
),
request_body = ClaimTx,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Transaction ID of successfully posted transaction",
    body = String
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id, claim_tx = body.tx), ret, err(
    Debug
))]
async fn post_claim_tx(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<ClaimTx>,
) -> Result<String, Error> {
    let belongs_to_borrower =
        db::contracts::check_if_contract_belongs_to_borrower(&data.db, &contract_id, &user.id)
            .await
            .map_err(Error::database)?;

    if !belongs_to_borrower {
        return Err(Error::NotYourContract);
    }

    let signed_claim_tx_str = body.tx;
    let signed_claim_tx: Transaction =
        bitcoin::consensus::encode::deserialize_hex(&signed_claim_tx_str)
            .map_err(Error::ParseClaimTx)?;
    let claim_txid = signed_claim_tx.compute_txid();

    data.mempool
        .send(mempool::TrackCollateralClaim {
            contract_id: contract_id.clone(),
            claim_txid,
            claim_type: mempool::ClaimTxType::Repaid,
        })
        .await
        .expect("actor to be alive")
        .map_err(Error::track_claim_tx)?;

    data.mempool
        .send(mempool::PostTx(signed_claim_tx_str))
        .await
        .expect("actor to be alive")
        .map_err(Error::post_claim_tx)?;

    // TODO: Use a database transaction.
    db::transactions::insert_claim_txid(&data.db, &contract_id, &claim_txid)
        .await
        .map_err(Error::database)?;
    db::contracts::mark_contract_as_closing(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    Ok(claim_txid.to_string())
}

/// Broadcast recover-collateral transaction.
#[utoipa::path(
post,
path = "/{id}/broadcast-recover",
params(
    (
    "id" = String, Path, description = "Contract ID"
    )
),
request_body = RecoverTx,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Transaction ID of successfully posted recovery transaction",
    body = String
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id), ret, err(Debug))]
async fn post_recover_tx(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<RecoverTx>,
) -> Result<String, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    // Only allow collateral recovery if the contract is in the `CollateralRecoverable` state.
    if contract.status != ContractStatus::CollateralRecoverable {
        return Err(Error::InvalidRecoveryRequest {
            status: contract.status,
        });
    }

    let signed_recovery_tx: Transaction =
        bitcoin::consensus::encode::deserialize_hex(&body.tx).map_err(Error::ParseClaimTx)?;
    let recovery_txid = signed_recovery_tx.compute_txid();

    // Track the recovery transaction
    data.mempool
        .send(mempool::TrackCollateralClaim {
            contract_id: contract_id.clone(),
            claim_txid: recovery_txid,
            claim_type: mempool::ClaimTxType::Recovery,
        })
        .await
        .expect("actor to be alive")
        .map_err(Error::track_claim_tx)?;

    data.mempool
        .send(mempool::PostTx(body.tx))
        .await
        .expect("actor to be alive")
        .map_err(Error::post_claim_tx)?;

    db::transactions::insert_claim_txid(&data.db, &contract_id, &recovery_txid)
        .await
        .map_err(Error::database)?;

    db::contracts::mark_contract_as_closed_by_recovery(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    Ok(recovery_txid.to_string())
}

/// Post a request to extend the contract.
#[utoipa::path(
post,
path = "/{id}/extend",
params(
    (
    "id" = String, Path, description = "Contract ID"
    )
),
request_body = ExtendContractRequestSchema,
tag = CONTRACTS_TAG,
responses(
    (
    status = 200,
    description = "Ok if successful",
    body = Contract,
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, %contract_id, body = ?body), ret, err(Debug))]
async fn post_extend_contract_request(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<ExtendContractRequestSchema>,
) -> Result<AppJson<Contract>, Error> {
    let contract = db::contracts::load_contract(&data.db, contract_id.as_str())
        .await
        .map_err(|e| Error::MissingContract(format!("{e:#}")))?;
    let current_price =
        get_bitmex_index_price(&data.config, OffsetDateTime::now_utc(), contract.asset)
            .await
            .map_err(Error::bitmex_price)?;

    let new_contract = crate::contract_extension::request_contract_extension(
        &data.db,
        &data.config,
        &data.mempool,
        &contract_id,
        &user.id,
        body.new_duration,
        current_price,
    )
    .await
    .map_err(Error::from)?;

    let contract = map_to_api_contract(&data, new_contract).await?;

    Ok(AppJson(contract))
}

/// Update borrower btc address of a contract.
#[utoipa::path(
    put,
    path = "/{id}/borrower-address",
    params(
        (
        "id" = String, Path, description = "Contract id"
        )
    ),
    request_body = UpdateBorrowerBtcAddress,
    tag = CONTRACTS_TAG,
    responses(
        (
        status = 200,
        description = "Ok if successful",
        )
    ),
    security(
        (
        "api_key" = [])
        )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, contract_id, body), ret, err(Debug))]
async fn put_borrower_btc_address(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(contract_id): Path<String>,
    AppJson(body): AppJson<UpdateBorrowerBtcAddress>,
) -> Result<AppJson<()>, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        contract_id.as_str(),
        user.id.as_str(),
    )
    .await
    .map_err(Error::database)?;

    let pk = contract.borrower_pk;

    let address = body.address.assume_checked();
    if !crate::wallet::is_signed_by_pk(
        address.to_string().as_str(),
        &pk.inner,
        body.recoverable_signature_hex,
        body.recoverable_signature_id,
    )
    .map_err(Error::bad_signature_provided)?
    {
        return Err(Error::InvalidSignatureProvided);
    }

    if !update_borrower_btc_address(&data.db, contract_id.as_str(), user.id.as_str(), address)
        .await
        .map_err(Error::database)?
    {
        return Err(Error::UpdateBorrowerAddress);
    }
    Ok(AppJson(()))
}

/// Response containing the generated Bitcoin invoice and corresponding installment.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct GenerateBitcoinInvoiceResponse {
    /// The generated Bitcoin invoice.
    pub invoice: BitcoinRepaymentInvoiceResponse,
    /// The installment being paid.
    pub installment: Installment,
}

/// Bitcoin repayment invoice response for API.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct BitcoinRepaymentInvoiceResponse {
    pub id: Uuid,
    pub installment_id: Uuid,
    pub amount_sats: u64,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_usd: Decimal,
    #[schema(value_type = String)]
    pub address: Address<NetworkUnchecked>,
    #[serde(with = "time::serde::rfc3339")]
    pub expires_at: OffsetDateTime,
    pub status: BitcoinInvoiceStatus,
    pub txid: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

/// Generate a Bitcoin repayment invoice for a contract installment.
///
/// Creates a Bitcoin invoice based on the current Bitcoin price for the next pending installment.
/// Only works for USD-based loans and contracts with Bitcoin repayment address configured.
#[utoipa::path(
    post,
    path = "/{id}/generate-btc-invoice",
    tag = CONTRACTS_TAG,
    params(
        ("id", Path, description = "Contract ID")
    ),
    responses(
        (
            status = 200,
            description = "Bitcoin invoice generated successfully",
            body = GenerateBitcoinInvoiceResponse
        ),
        (
            status = 400,
            description = "Bad request - currency not supported, no BTC address, existing invoice, etc."
        ),
        (
            status = 404,
            description = "Contract not found"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(
    skip_all,
    fields(
        borrower_id = user.id,
        contract_id = %contract_id
    ),
    ret,
    err(Debug)
)]
async fn post_generate_btc_invoice(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<String>,
    Extension(user): Extension<Borrower>,
) -> Result<AppJson<GenerateBitcoinInvoiceResponse>, Error> {
    let now = OffsetDateTime::now_utc();

    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &contract_id,
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    if contract.currency() != Currency::Usd {
        return Err(Error::UnsupportedCurrencyForBitcoinRepayment {
            currency: contract.currency(),
        });
    }

    let btc_address = contract
        .lender_btc_loan_repayment_address
        .ok_or(Error::NoBitcoinRepaymentAddress)?;

    let installments = db::installments::get_all_for_contract_id(&data.db, &contract_id)
        .await
        .map_err(Error::database)?;

    let next_pending_installment = installments
        .iter()
        .filter(|i| matches!(i.status, InstallmentStatus::Pending))
        .min_by_key(|i| i.due_date)
        .ok_or(Error::NoPendingInstallments)?;

    // Check if there's already a non-expired pending invoice and return it if found.
    if let Some(existing_invoice) = db::bitcoin_repayment::get_newest_non_expired_pending_invoice(
        &data.db,
        next_pending_installment.id,
        now,
    )
    .await
    .map_err(Error::database)?
    {
        let response = GenerateBitcoinInvoiceResponse {
            invoice: existing_invoice.into(),
            installment: Installment::from(next_pending_installment.clone()),
        };
        return Ok(AppJson(response));
    }

    let bitcoin_price_usd = get_bitmex_index_price(&data.config, now, contract.asset)
        .await
        .map_err(|e| Error::BitMexPrice(format!("{e:#}")))?;

    let installment_amount_usd = next_pending_installment.total_amount_due();

    let amount_btc = crate::model::usd_to_btc(installment_amount_usd, bitcoin_price_usd)
        .map_err(Error::currency_conversion)?;

    let bitcoin_invoice = BitcoinInvoice::new(
        now,
        next_pending_installment.id,
        amount_btc,
        installment_amount_usd,
        btc_address,
    );

    db::bitcoin_repayment::insert(&data.db, bitcoin_invoice.clone())
        .await
        .map_err(Error::database)?;

    let response = GenerateBitcoinInvoiceResponse {
        invoice: bitcoin_invoice.into(),
        installment: Installment::from(next_pending_installment.clone()),
    };

    Ok(AppJson(response))
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ReportBitcoinPaymentRequest {
    /// Bitcoin transaction ID of the payment.
    #[schema(value_type = String)]
    pub txid: Txid,
    #[schema(value_type = String)]
    pub invoice_id: Uuid,
}

/// Report the payment of a Bitcoin repayment invoice.
///
/// Allows the borrower to submit a Bitcoin transaction ID to mark an invoice and its corresponding
/// installment as paid from their perspective.
#[utoipa::path(
    put,
    path = "/{id}/btc-invoice-paid",
    tag = CONTRACTS_TAG,
    params(
        ("id", Path, description = "Bitcoin invoice ID")
    ),
    request_body = ReportBitcoinPaymentRequest,
    responses(
        (
            status = 200,
            description = "Bitcoin payment reported successfully"
        ),
        (
            status = 400,
            description = "Bad request - invoice expired, invalid state, etc."
        ),
        (
            status = 404,
            description = "Invoice not found"
        )
    ),
    security(
        ("api_key" = [])
    )
)]
#[instrument(
    skip_all,
    fields(
        borrower_id = user.id,
        invoice_id = %body.invoice_id,
        txid = %body.txid
    ),
    ret,
    err(Debug)
)]
async fn put_report_btc_payment(
    State(data): State<Arc<AppState>>,
    Path(contract_id): Path<Uuid>,
    Extension(user): Extension<Borrower>,
    AppJson(body): AppJson<ReportBitcoinPaymentRequest>,
) -> Result<(), Error> {
    let now = OffsetDateTime::now_utc();

    let invoice = db::bitcoin_repayment::get_by_id(&data.db, body.invoice_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingBitcoinInvoice)?;

    if !invoice.can_report_payment() {
        return Err(Error::InvalidBitcoinInvoiceState);
    }

    if invoice.is_expired(now) {
        return Err(Error::ExpiredBitcoinInvoice);
    }

    let installment = db::installments::get_by_id(&data.db, invoice.installment_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingBitcoinInvoice)?;

    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        &data.db,
        &installment.contract_id.to_string(),
        &user.id,
    )
    .await
    .map_err(Error::database)?;

    if contract.id != contract_id.to_string() {
        return Err(Error::bad_request("Invoice doesn't match contract ID"));
    }

    db::bitcoin_repayment::mark_as_paid(&data.db, body.invoice_id, body.txid)
        .await
        .map_err(Error::database)?;

    db::installments::mark_as_paid(&data.db, invoice.installment_id, &body.txid.to_string())
        .await
        .map_err(Error::database)?;

    db::transactions::insert_installment_paid_txid(&data.db, &contract.id, &body.txid.to_string())
        .await
        .map_err(Error::database)?;

    // Check if all installments are now paid to mark contract as `RepaymentProvided`.
    let all_installments = db::installments::get_all_for_contract_id(&data.db, &contract.id)
        .await
        .map_err(Error::database)?;

    let is_repayment_provided = !all_installments.is_empty()
        && all_installments.iter().all(|i| {
            matches!(
                i.status,
                InstallmentStatus::Cancelled
                    | InstallmentStatus::Paid
                    | InstallmentStatus::Confirmed
            )
        });

    if is_repayment_provided {
        db::contracts::mark_contract_as_repayment_provided(&data.db, &contract.id)
            .await
            .map_err(Error::database)?;
    }

    let loan_url = data
        .config
        .lender_frontend_origin
        .join(&format!("/my-contracts/{}", contract.id))
        .expect("to be valid url");

    if let Err(e) = async {
        let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
            .await?
            .context("Failed to find lender")?;

        data.notifications
            .send_installment_paid(lender, loan_url, installment.id, &contract.id)
            .await;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed to send email notification: {e:?}");
    }

    Ok(())
}

// This struct and some of its fields are public to help with e2e testing.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct Contract {
    pub id: String,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount: Decimal,
    /// Total amount owed. This includes
    /// - loan principal
    /// - outstanding interest
    #[serde(with = "rust_decimal::serde::float")]
    balance_outstanding: Decimal,
    duration_days: i32,
    pub initial_collateral_sats: u64,
    pub origination_fee_sats: u64,
    collateral_sats: u64,
    #[serde(with = "rust_decimal::serde::float")]
    interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    interest: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    initial_ltv: Decimal,
    loan_asset: LoanAsset,
    pub status: ContractStatus,
    #[schema(value_type = String)]
    borrower_pk: PublicKey,
    #[schema(value_type = Option<String>)]
    pub borrower_derivation_path: Option<DerivationPath>,
    #[schema(value_type = String)]
    lender_pk: PublicKey,
    borrower_btc_address: String,
    borrower_loan_address: Option<String>,
    pub contract_address: Option<String>,
    loan_repayment_address: Option<String>,
    btc_loan_repayment_address: Option<String>,
    collateral_script: Option<String>,
    lender: LenderStats,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    expiry: OffsetDateTime,
    liquidation_status: LiquidationStatus,
    transactions: Vec<LoanTransaction>,
    loan_type: LoanType,
    #[serde(with = "rust_decimal::serde::float")]
    liquidation_price: Decimal,
    extends_contract: Option<String>,
    extended_by_contract: Option<String>,
    kyc_info: Option<KycInfo>,
    fiat_loan_details_borrower: Option<FiatLoanDetailsWrapperResponse>,
    fiat_loan_details_lender: Option<FiatLoanDetailsWrapperResponse>,
    lender_npub: Npub,
    timeline: Vec<TimelineEvent>,
    client_contract_id: Option<Uuid>,
    extension_max_duration_days: u64,
    #[serde(with = "rust_decimal::serde::float_option")]
    extension_interest_rate: Option<Decimal>,
    extension_origination_fee: Vec<OriginationFee>,
    pub installments: Vec<Installment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Installment {
    pub id: Uuid,
    #[serde(with = "rust_decimal::serde::float")]
    principal: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    interest: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    due_date: OffsetDateTime,
    status: InstallmentStatus,
    #[serde(with = "time::serde::rfc3339::option")]
    paid_date: Option<OffsetDateTime>,
    payment_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
struct TimelineEvent {
    #[serde(with = "time::serde::rfc3339")]
    date: OffsetDateTime,
    event: TimelineEventKind,
    /// Only provided if it was an event caused by a transaction.
    txid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
enum TimelineEventKind {
    #[schema(title = "contract_status_change")]
    ContractStatusChange { status: ContractStatus },
    #[schema(title = "installment_payment")]
    InstallmentPayment {
        is_confirmed: bool,
        installment_id: Uuid,
    },
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct FiatLoanDetailsWrapperResponse {
    details: FiatLoanDetails,
    /// The borrower's encrypted encryption key.
    encrypted_encryption_key: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct KycInfo {
    kyc_link: Url,
    is_kyc_done: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SpendCollateralPsbt {
    pub psbt: String,
    #[schema(value_type = String)]
    pub collateral_descriptor: Descriptor<PublicKey>,
    #[schema(value_type = String)]
    pub borrower_pk: PublicKey,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClaimTx {
    pub tx: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RecoverTx {
    pub tx: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
struct ExtendContractRequestSchema {
    /// The number of days to be added on top of the current duration.
    new_duration: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
struct UpdateBorrowerBtcAddress {
    #[schema(value_type = String)]
    address: Address<NetworkUnchecked>,
    /// A recoverable signature of the address using "bitcoin's" signing protocol, i.e. the message
    /// (`address`) is prepended with b"\x18Bitcoin Signed Message:\n".
    ///
    /// The message needs to be signed using the sk behind the pk in the corresponding contract.
    /// See https://docs.rs/satsnet/latest/src/satsnet/sign_message.rs.html#201-208
    recoverable_signature_hex: String,
    recoverable_signature_id: i32,
}

/// Convert from a [`model::Contract`] to a [`Contract`].
async fn map_to_api_contract(
    data: &Arc<AppState>,
    contract: model::Contract,
) -> Result<Contract, Error> {
    let loan_deal = db::loan_deals::get_loan_deal_by_id(&data.db, &contract.loan_id)
        .await
        .map_err(Error::database)?;

    let lender = db::lenders::get_user_by_id(&data.db, &contract.lender_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    let transactions = db::transactions::get_all_for_contract_id(&data.db, &contract.id)
        .await
        .map_err(Error::database)?;

    let parent_contract_id =
        db::contract_extensions::get_parent_by_extended(&data.db, &contract.id)
            .await
            .map_err(|e| Error::database(anyhow!(e)))?;
    let child_contract = db::contract_extensions::get_extended_by_parent(&data.db, &contract.id)
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    let kyc_info = match loan_deal.kyc_link() {
        Some(ref kyc_link) => {
            let is_kyc_done = db::kyc::get(&data.db, &lender.id, &contract.borrower_id)
                .await
                .map_err(Error::database)?;

            Some(KycInfo {
                kyc_link: kyc_link.clone(),
                is_kyc_done: is_kyc_done.unwrap_or(false),
            })
        }
        None => None,
    };

    let new_offer = loan_deal;

    let lender_stats = user_stats::get_lender_stats(&data.db, &lender.id)
        .await
        .map_err(Error::from)?;

    let fiat_loan_details_borrower = {
        let details = db::fiat_loan_details::get_borrower(&data.db, &contract.id)
            .await
            .map_err(Error::database)?;

        details.map(|d| FiatLoanDetailsWrapperResponse {
            details: d.details,
            encrypted_encryption_key: d.encrypted_encryption_key_borrower,
        })
    };

    let fiat_loan_details_lender = {
        let details = db::fiat_loan_details::get_lender(&data.db, &contract.id)
            .await
            .map_err(Error::database)?;

        details.map(|d| FiatLoanDetailsWrapperResponse {
            details: d.details,
            encrypted_encryption_key: d.encrypted_encryption_key_borrower,
        })
    };

    let collateral_script = match contract.contract_index {
        Some(contract_index) => {
            let collateral_descriptor = data
                .wallet
                .collateral_descriptor(
                    contract.borrower_pk,
                    contract.lender_pk,
                    contract.contract_version,
                    contract_index,
                )
                .map_err(Error::cannot_build_descriptor)?;
            let collateral_script = collateral_descriptor.script_code().expect("not taproot");
            let collateral_script = collateral_script.to_hex_string();

            Some(collateral_script)
        }
        None => None,
    };

    let installments = db::installments::get_all_for_contract_id(&data.db, &contract.id)
        .await
        .map_err(Error::database)?;

    let liquidation_price = contract.liquidation_price(&installments);

    let timeline = map_timeline(&contract, &transactions, &data.db, &installments).await?;

    let (extension_max_duration_days, extension_interest_rate) = match contract.extension_policy {
        ExtensionPolicy::DoNotExtend => (0, None),
        ExtensionPolicy::AfterHalfway {
            max_duration_days,
            interest_rate,
        } => (max_duration_days, Some(interest_rate)),
    };

    let extension_origination_fee = data.config.extension_origination_fee.clone();

    let total_interest = compute_total_interest(&installments);

    let balance_outstanding = compute_outstanding_balance(&installments).total();

    let contract = Contract {
        id: contract.id,
        loan_amount: contract.loan_amount,
        balance_outstanding,
        duration_days: contract.duration_days,
        initial_collateral_sats: contract.initial_collateral_sats,
        origination_fee_sats: contract.origination_fee_sats,
        collateral_sats: contract.collateral_sats,
        interest_rate: contract.interest_rate,
        interest: total_interest,
        initial_ltv: contract.initial_ltv,
        loan_asset: new_offer.loan_asset(),
        status: contract.status,
        borrower_pk: contract.borrower_pk,
        borrower_derivation_path: contract.borrower_derivation_path,
        lender_pk: contract.lender_pk,
        borrower_btc_address: contract.borrower_btc_address.assume_checked().to_string(),
        borrower_loan_address: contract.borrower_loan_address,
        contract_address: contract
            .contract_address
            .map(|c| c.assume_checked().to_string()),
        loan_repayment_address: contract.lender_loan_repayment_address,
        btc_loan_repayment_address: contract
            .lender_btc_loan_repayment_address
            .map(|c| c.to_string()),
        collateral_script,
        lender: lender_stats,
        created_at: contract.created_at,
        updated_at: contract.updated_at,
        expiry: contract.expiry_date,
        liquidation_status: contract.liquidation_status,
        transactions,
        loan_type: contract.loan_type,
        liquidation_price,
        extends_contract: parent_contract_id,
        extended_by_contract: child_contract,
        kyc_info,
        fiat_loan_details_borrower,
        fiat_loan_details_lender,
        lender_npub: contract.lender_npub,
        timeline,
        client_contract_id: contract.client_contract_id,
        extension_max_duration_days,
        extension_interest_rate,
        extension_origination_fee,
        installments: installments.into_iter().map(Installment::from).collect(),
    };

    Ok(contract)
}

async fn map_timeline(
    contract: &model::Contract,
    transactions: &[LoanTransaction],
    pool: &Pool<Postgres>,
    installments: &[model::Installment],
) -> Result<Vec<TimelineEvent>, Error> {
    let event_logs = db::contract_status_log::get_contract_status_logs(pool, &contract.id)
        .await
        .map_err(|e| Error::database(anyhow!(e)))?;

    // First, we build the contract request event.
    let mut requested_event = TimelineEvent {
        date: contract.created_at,
        event: TimelineEventKind::ContractStatusChange {
            status: ContractStatus::Requested,
        },
        txid: None,
    };

    let mut timeline = vec![];

    // Next we generate events based on paid and confirmed installments.
    installments.iter().for_each(|i| {
        if let Some(paid_date) = i.paid_date {
            let event = TimelineEvent {
                date: paid_date,
                event: TimelineEventKind::InstallmentPayment {
                    is_confirmed: matches!(i.status, InstallmentStatus::Confirmed),
                    installment_id: i.id,
                },
                txid: i.payment_id.clone(),
            };
            timeline.push(event);
        }
    });

    let mut first_funding_transaction = None;

    // We then go through each contract status change, enhancing them with transaction IDs if
    // applicable.
    let rest_of_timeline = event_logs
        .into_iter()
        .map(|log| {
            let txid = match log.new_status {
                // A contract should only ever transition to `CollateralSeen` and
                // `CollateralConfirmed` once.
                ContractStatus::CollateralSeen | ContractStatus::CollateralConfirmed => {
                    // In both cases, we take the _first_ funding transaction.
                    //
                    // It could be the case that the contract is originally funded with more than
                    // one transaction, but we accept that we do not handle that edge case
                    // perfectly.
                    transactions.iter().find_map(|tx| {
                        (tx.transaction_type == TransactionType::Funding).then(|| {
                            first_funding_transaction = Some(tx.txid.clone());
                            tx.txid.clone()
                        })
                    })
                }
                ContractStatus::PrincipalGiven => transactions.iter().find_map(|tx| {
                    (tx.transaction_type == TransactionType::PrincipalGiven)
                        .then(|| tx.txid.clone())
                }),
                ContractStatus::Closing | ContractStatus::Closed | ContractStatus::Defaulted => {
                    transactions.iter().find_map(|tx| {
                        (tx.transaction_type == TransactionType::ClaimCollateral)
                            .then(|| tx.txid.clone())
                    })
                }
                ContractStatus::ClosedByDefaulting => transactions.iter().find_map(|tx| {
                    (tx.transaction_type == TransactionType::Defaulted).then(|| tx.txid.clone())
                }),
                ContractStatus::ClosedByLiquidation => transactions.iter().find_map(|tx| {
                    (tx.transaction_type == TransactionType::Liquidation).then(|| tx.txid.clone())
                }),
                ContractStatus::ClosedByRecovery => transactions.iter().find_map(|tx| {
                    (tx.transaction_type == TransactionType::ClaimCollateral)
                        .then(|| tx.txid.clone())
                }),
                ContractStatus::Requested
                | ContractStatus::Approved
                | ContractStatus::RepaymentProvided
                | ContractStatus::RepaymentConfirmed
                | ContractStatus::Undercollateralized
                | ContractStatus::Extended
                | ContractStatus::Rejected
                | ContractStatus::DisputeBorrowerStarted
                | ContractStatus::DisputeLenderStarted
                | ContractStatus::Cancelled
                | ContractStatus::RequestExpired
                | ContractStatus::ApprovalExpired
                | ContractStatus::CollateralRecoverable => {
                    // There are no transactions associated with these events.
                    None
                }
            };

            TimelineEvent {
                date: log.changed_at,
                event: TimelineEventKind::ContractStatusChange {
                    status: log.new_status,
                },
                txid,
            }
        })
        .collect::<Vec<_>>();

    // Finally, we process all funding transactions, ensuring that we skip the very first one
    // (already linked to `CollateralSeen` or `CollateralConfirmed` above).
    transactions.iter().for_each(|tx| {
        if TransactionType::Funding == tx.transaction_type
            && first_funding_transaction.as_ref() != Some(&tx.txid)
        {
            timeline.push(TimelineEvent {
                date: tx.timestamp,
                // TODO: For now we treat all of these transactions as a new instance of
                // `CollateralConfirmed`. Instead we should model this differently so that:
                //
                // - Adding more collateral can be represented differently in the frontend.
                // - Transactions that add more collateral can be either unconfirmed or confirmed.
                event: TimelineEventKind::ContractStatusChange {
                    status: ContractStatus::CollateralConfirmed,
                },
                txid: Some(tx.txid.clone()),
            });
        }
    });

    timeline.extend(rest_of_timeline);

    let approved_event = timeline.iter().find(|e| {
        matches!(
            e.event,
            TimelineEventKind::ContractStatusChange {
                status: ContractStatus::Approved
            }
        )
    });

    // HACK: After extending a contract, the `Requested` event will not be the first one, given that
    // the extended contract is created later than any event in the original contract. To deal with
    // this, we can just set the time to an hour before the original contract was approved.
    if let Some(approved_event) = approved_event {
        if approved_event.date < requested_event.date {
            requested_event.date = approved_event.date - 1.hours();
        }
    }

    timeline.push(requested_event);

    timeline.sort_by(|a, b| a.date.cmp(&b.date));

    let confirmed_events = timeline
        .iter()
        .filter(|e| {
            matches!(
                e.event,
                TimelineEventKind::ContractStatusChange {
                    status: ContractStatus::CollateralConfirmed,
                }
            )
        })
        .cloned()
        .collect::<Vec<_>>();
    let timeline = timeline
        .into_iter()
        // Filter out `CollateralSeen` events for which we already have a `CollateralConfirmed`
        // entry, because they are redundant.
        .filter(|e| {
            !matches!(e.event, TimelineEventKind::ContractStatusChange {
                status: ContractStatus::CollateralSeen,
            } if confirmed_events.iter().any(|ce| ce.txid == e.txid))
        })
        .collect();

    Ok(timeline)
}

// Error fields are allowed to be dead code because they are actually used when printed in logs.
/// All the errors related to the `contracts` REST API.
#[derive(Debug)]
enum Error {
    /// Bad request error for invalid inputs.
    BadRequest(#[allow(dead_code)] String),
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Referenced loan does not exist.
    MissingLoanOffer {
        #[allow(dead_code)]
        id: String,
    },
    /// Referenced lender does not exist.
    MissingLender,
    /// Failed to provide borrower loan address for stablecoin loan.
    MissingBorrowerLoanAddress,
    /// Moon only supports USDC on Polygon.
    InvalidMoonLoanRequest {
        asset: LoanAsset,
    },
    /// The Moon card that the borrower is trying to top up does not exist.
    CannotTopUpNonexistentCard,
    /// The attempt to top up the card would push the balance over the limit.
    CannotTopUpOverLimit {
        current_balance: Decimal,
        loan_amount: Decimal,
        limit: Decimal,
    },
    /// Moon cards cannot be topped up if we don't know the client IP.
    CannotTopUpMoonCardWithoutIp,
    /// Failed to get country code of IP from GeoJS.
    GeoJs(#[allow(dead_code)] String),
    /// Moon cards cannot be topped up from the US.
    CannotTopUpMoonCardFromUs,
    /// Failed to create Moon card.
    MoonCardGeneration(#[allow(dead_code)] String),
    /// Failed to generate Moon invoice.
    MoonInvoiceGeneration(#[allow(dead_code)] String),
    /// Failed to get price from BitMEX.
    BitMexPrice(#[allow(dead_code)] String),
    /// Failed to convert between currencies.
    CurrencyConversion(#[allow(dead_code)] String),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(#[allow(dead_code)] String),
    /// Can't approve a contract request with a [`ContractStatus`] different to
    /// [`ContractStatus::Requested`].
    InvalidApproveRequest {
        status: ContractStatus,
    },
    /// Can't cancel a contract request with a [`ContractStatus`] different to
    /// [`ContractStatus::Requested`].
    InvalidCancelRequest {
        status: ContractStatus,
    },
    /// Can't claim collateral if principal and interest have not been repaid.
    LoanNotRepaid,
    /// Can't claim collateral without contract index.
    MissingContractIndex,
    /// Can't continue without collateral address.
    MissingCollateralAddress,
    /// Failed to generate contract address.
    ContractAddress(#[allow(dead_code)] String),
    /// Referenced borrower does not exist.
    MissingBorrower,
    /// Failed to track accepted contract using Mempool API.
    TrackContract(#[allow(dead_code)] String),
    /// Can't find collateral outputs to claim.
    MissingCollateralOutputs,
    /// Failed to create claim-collateral PSBT.
    CreateClaimCollateralPsbt(#[allow(dead_code)] String),
    /// Failed to parse signed claim-collateral transaction.
    ParseClaimTx(#[allow(dead_code)] FromHexError),
    /// Failed to track claim-collateral transaction.
    TrackClaimTx(#[allow(dead_code)] String),
    /// Failed to post claim-collateral transaction.
    PostClaimTx(#[allow(dead_code)] String),
    /// The borrower is trying to interact with a contract that is not theirs, according to our
    /// records.
    NotYourContract,
    /// We failed at calculating the interest rate. Cannot do much without this
    InterestRateCalculation(#[allow(dead_code)] String),
    /// Discounted origination fee rate was not valid
    InvalidDiscountRate {
        #[allow(dead_code)]
        fee: Decimal,
    },
    /// A fiat loan must use a fiat asset.
    FiatLoanWithoutFiatAsset {
        asset: LoanAsset,
    },
    /// A request for a fiat loan offer does not include the necessary fiat loan details.
    MissingFiatLoanDetails,
    InvalidLoanAmount {
        amount: Decimal,
        loan_amount_min: Decimal,
        loan_amount_max: Decimal,
    },
    ZeroLoanDuration,
    ZeroLoanExtensionDuration,
    InvalidLoanDuration {
        duration_days: i32,
        duration_days_min: i32,
        duration_days_max: i32,
    },
    /// Failed to build contract descriptor.
    CannotBuildDescriptor(#[allow(dead_code)] String),
    /// Cannot approve renewal without contract address.
    MissingContractAddress,
    /// Missing contract.
    MissingContract(String),
    /// Cannot open loan with Bringin as loan address without the borrower's IP.
    CannotUseBringinWithoutIp,
    /// Bringin does not support this loan asset.
    InvalidBringinAsset {
        invalid_asset: LoanAsset,
        supported_assets: Vec<LoanAsset>,
    },
    /// No Bringin API key associated with this borrower.
    NoBringinApiKey,
    /// An error coming from Bringin.
    Bringin(#[allow(dead_code)] String),
    /// The requested loan amount is out of the bounds imposed by Bringin.
    BringinLoanAmountOutOfBounds {
        min: Decimal,
        max: Decimal,
        loan_amount: Decimal,
    },
    /// Extension is not currently supported for this contract.
    ExtensionNotAllowed,
    /// Extension will be possible at a later time.
    ExtensionTooSoon,
    /// Extension is only possible for `max_duration_days`.
    ExtensionTooManyDays {
        max_duration_days: u64,
    },
    /// We failed updating the borrower's bitcoin address in the DB
    UpdateBorrowerAddress,
    /// The signature provided was not valid
    BadSignatureProvided(#[allow(dead_code)] String),
    /// The signature provided did not fit to the message
    InvalidSignatureProvided,
    /// Failed to compute installments based on extension.
    ComputeExtensionInstallments(#[allow(dead_code)] String),
    /// Stablecoin loan type has incompatible loan payout.
    InvalidStableCoinLoanPayout {
        actual_payout: LoanPayout,
    },
    /// PayWithMoon loan type requires Direct loan payout.
    InvalidPayWithMoonPayout {
        actual_payout: LoanPayout,
    },
    /// MoonCardInstant loan type requires MoonCardInstant loan payout.
    InvalidMoonCardInstantPayout {
        actual_payout: LoanPayout,
    },
    /// Can't recover collateral from a contract not in `CollateralRecoverable` status.
    InvalidRecoveryRequest {
        status: ContractStatus,
    },
    /// Bitcoin repayment is not supported for this contract's currency.
    UnsupportedCurrencyForBitcoinRepayment {
        currency: Currency,
    },
    /// Contract does not have a Bitcoin repayment address configured.
    NoBitcoinRepaymentAddress,
    /// No pending installments found for this contract.
    NoPendingInstallments,
    /// The Bitcoin repayment invoice was not found.
    MissingBitcoinInvoice,
    /// The Bitcoin repayment invoice is expired.
    ExpiredBitcoinInvoice,
    /// The Bitcoin repayment invoice cannot accept payment in its current state.
    InvalidBitcoinInvoiceState,
    /// User in in jail and can't do anything
    UserInJail,
}

impl Error {
    // Since these errors are just meant to be displayed, it's okay to store `String`s. Ideally, we
    // would log the `anyhow::Error` via `tracing` using the alternate selector, but that's not
    // supported yet: https://github.com/tokio-rs/tracing/issues/1311.

    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
    }

    fn geo_js(e: impl std::fmt::Display) -> Self {
        Self::GeoJs(format!("{e:#}"))
    }

    fn moon_card_generation(e: impl std::fmt::Display) -> Self {
        Self::MoonCardGeneration(format!("{e:#}"))
    }

    fn moon_invoice_generation(e: impl std::fmt::Display) -> Self {
        Self::MoonInvoiceGeneration(format!("{e:#}"))
    }

    fn bitmex_price(e: impl std::fmt::Display) -> Self {
        Self::BitMexPrice(format!("{e:#}"))
    }

    fn currency_conversion(e: impl std::fmt::Display) -> Self {
        Self::CurrencyConversion(format!("{e:#}"))
    }

    fn origination_fee_calculation(e: impl std::fmt::Display) -> Self {
        Self::OriginationFeeCalculation(format!("{e:#}"))
    }

    fn cannot_build_descriptor(e: impl std::fmt::Display) -> Self {
        Self::CannotBuildDescriptor(format!("{e:#}"))
    }

    fn interest_rate_calculation(e: impl std::fmt::Display) -> Self {
        Self::InterestRateCalculation(format!("{e:#}"))
    }

    fn contract_address(e: impl std::fmt::Display) -> Self {
        Self::ContractAddress(format!("{e:#}"))
    }

    fn track_contract(e: impl std::fmt::Display) -> Self {
        Self::TrackContract(format!("{e:#}"))
    }

    fn create_claim_collateral_psbt(e: impl std::fmt::Display) -> Self {
        Self::CreateClaimCollateralPsbt(format!("{e:#}"))
    }

    fn track_claim_tx(e: impl std::fmt::Display) -> Self {
        Self::TrackClaimTx(format!("{e:#}"))
    }

    fn post_claim_tx(e: impl std::fmt::Display) -> Self {
        Self::PostClaimTx(format!("{e:#}"))
    }

    fn bringin(e: impl std::fmt::Display) -> Self {
        Self::Bringin(format!("{e:#}"))
    }

    fn bad_signature_provided(e: impl std::fmt::Display) -> Self {
        Self::BadSignatureProvided(format!("{e:#}"))
    }

    fn bad_request(e: impl std::fmt::Display) -> Self {
        Self::BadRequest(format!("{e:#}"))
    }
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

// Create our own JSON extractor by wrapping `axum::Json`. This makes it easy to override the
// rejection and provide our own which formats errors to match our application.
//
// `axum::Json` responds with plain text if the input is invalid.
#[derive(Debug, FromRequest)]
#[from_request(via(Json), rejection(Error))]
struct AppJson<T>(T);

impl<T> IntoResponse for AppJson<T>
where
    Json<T>: IntoResponse,
{
    fn into_response(self) -> Response {
        Json(self.0).into_response()
    }
}

/// Tell `axum` how [`AppError`] should be converted into a response.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::JsonRejection(rejection) => (rejection.status(), rejection.body_text()),
            Error::Database(_)
            | Error::MissingLoanOffer { .. }
            | Error::MissingLender
            | Error::MoonCardGeneration(_)
            | Error::MoonInvoiceGeneration(_)
            | Error::BitMexPrice(_)
            | Error::CurrencyConversion(_)
            | Error::MissingOriginationFee
            | Error::OriginationFeeCalculation(_)
            | Error::MissingContractIndex
            | Error::MissingCollateralAddress
            | Error::ContractAddress(_)
            | Error::MissingBorrower
            | Error::TrackContract(_)
            | Error::MissingCollateralOutputs
            | Error::TrackClaimTx(_)
            | Error::PostClaimTx(_)
            | Error::InterestRateCalculation(_)
            | Error::InvalidDiscountRate { .. }
            | Error::CreateClaimCollateralPsbt(_)
            | Error::CannotBuildDescriptor(_)
            | Error::GeoJs(_)
            | Error::MissingContractAddress
            | Error::Bringin(_)
            | Error::ComputeExtensionInstallments(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_string(),
            ),
            Error::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.to_string()),
            Error::MissingBorrowerLoanAddress => (
                StatusCode::BAD_REQUEST,
                "Failed to provide borrower loan \
                 address for stablecoin loan"
                    .to_string(),
            ),
            Error::InvalidMoonLoanRequest { asset } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Cannot create loan request for Moon \
                     card with asset {asset:?}. Moon only supports USDC on Polygon"
                ),
            ),
            Error::CannotTopUpNonexistentCard => {
                (StatusCode::NOT_FOUND, "Card not found".to_string())
            }
            Error::CannotTopUpOverLimit {
                current_balance,
                loan_amount,
                limit,
            } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Invalid Moon card top-up request: current balance \
                     ({current_balance}) + loan amount ({loan_amount}) > \
                     limit ({limit})"
                ),
            ),
            Error::CannotTopUpMoonCardWithoutIp => (
                StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
                "Request IP required".to_string(),
            ),
            Error::CannotTopUpMoonCardFromUs => (
                StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
                "Cannot top up Moon card from the US".to_string(),
            ),
            Error::InvalidCancelRequest { status } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot cancel a contract request with status {status:?}"),
            ),
            Error::LoanNotRepaid => (
                StatusCode::BAD_REQUEST,
                "Cannot claim collateral until loan has been repaid".to_string(),
            ),
            Error::ParseClaimTx(_) => (
                StatusCode::BAD_REQUEST,
                "Failed to parse signed claim TX".to_string(),
            ),
            Error::NotYourContract => (StatusCode::NOT_FOUND, "Contract not found".to_string()),
            Error::InvalidApproveRequest { status } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot approve a contract request with status {status:?}"),
            ),
            Error::MissingFiatLoanDetails => (
                StatusCode::BAD_REQUEST,
                "Failed to provide bank details for fiat loan".to_string(),
            ),
            Error::FiatLoanWithoutFiatAsset { asset } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot create fiat contract with asset: {asset:?}"),
            ),
            Error::InvalidLoanAmount {
                amount,
                loan_amount_min,
                loan_amount_max,
            } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Invalid loan amount: ${amount} not in \
                     range ${loan_amount_min}-${loan_amount_max}"
                ),
            ),
            Error::ZeroLoanDuration => (
                StatusCode::BAD_REQUEST,
                "Loan duration cannot be zero".to_string(),
            ),
            Error::ZeroLoanExtensionDuration => (
                StatusCode::BAD_REQUEST,
                "Loan extension duration cannot be zero".to_string(),
            ),
            Error::InvalidLoanDuration {
                duration_days,
                duration_days_min,
                duration_days_max,
            } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Invalid loan duration: {duration_days} \
                     days not in range {duration_days_min}-{duration_days_max}"
                ),
            ),
            Error::MissingContract(contract_id) => (
                StatusCode::BAD_REQUEST,
                format!("Missing contract: {contract_id}"),
            ),
            Error::InvalidBringinAsset {
                invalid_asset,
                supported_assets,
            } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Bringin does not support loan asset {invalid_asset:?}. \
                     List of supported assets {supported_assets:?}"
                ),
            ),
            Error::CannotUseBringinWithoutIp => (
                StatusCode::BAD_REQUEST,
                "Cannot use Bringin without IP address".to_string(),
            ),
            Error::NoBringinApiKey => (
                StatusCode::BAD_REQUEST,
                "Cannot use Bringin without a Bringin API key".to_string(),
            ),
            Error::BringinLoanAmountOutOfBounds {
                min,
                max,
                loan_amount,
            } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Invalid loan amount for Bringin: {loan_amount}. \
                     Amount must be within {min}-{max}"
                ),
            ),
            Error::ExtensionNotAllowed => (
                StatusCode::BAD_REQUEST,
                "The contract cannnot be extended".to_string(),
            ),
            Error::ExtensionTooSoon => (
                StatusCode::BAD_REQUEST,
                "The contract can only be extended after \
                         half of the duration has passed"
                    .to_string(),
            ),
            Error::ExtensionTooManyDays { max_duration_days } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "The contract cannot be extended for that long. \
                             Maximum extension is {max_duration_days} days"
                ),
            ),
            Error::UpdateBorrowerAddress => (
                StatusCode::BAD_REQUEST,
                "Could not update address".to_string(),
            ),
            Error::BadSignatureProvided(_) => (
                StatusCode::BAD_REQUEST,
                "Bad signature provided".to_string(),
            ),
            Error::InvalidSignatureProvided => (
                StatusCode::BAD_REQUEST,
                "Invalid signature provided".to_string(),
            ),
            Error::InvalidStableCoinLoanPayout { actual_payout } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Stable loan type has invalid loan payout, \
                         but got {actual_payout:?}"
                ),
            ),
            Error::InvalidPayWithMoonPayout { actual_payout } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "PayWithMoon loan type requires Direct loan payout, \
                         but got {actual_payout:?}"
                ),
            ),
            Error::InvalidMoonCardInstantPayout { actual_payout } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "MoonCardInstant loan type requires MoonCardInstant \
                         loan payout, but got {actual_payout:?}"
                ),
            ),
            Error::InvalidRecoveryRequest { status } => (
                StatusCode::BAD_REQUEST,
                format!("Cannot recover collateral from a contract with status {status:?}"),
            ),
            Error::UnsupportedCurrencyForBitcoinRepayment { currency } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Bitcoin repayment is not supported for {currency} loans. \
                    Only USD-based loans are supported"
                ),
            ),
            Error::NoBitcoinRepaymentAddress => (
                StatusCode::BAD_REQUEST,
                "This contract does not support Bitcoin repayment. The lender must \
                provide a Bitcoin repayment address"
                    .to_string(),
            ),
            Error::NoPendingInstallments => (
                StatusCode::BAD_REQUEST,
                "No pending installments found for this contract".to_string(),
            ),
            Error::MissingBitcoinInvoice => (
                StatusCode::NOT_FOUND,
                "Bitcoin repayment invoice not found".to_string(),
            ),
            Error::ExpiredBitcoinInvoice => (
                StatusCode::BAD_REQUEST,
                "This Bitcoin repayment invoice has expired".to_string(),
            ),
            Error::InvalidBitcoinInvoiceState => (
                StatusCode::BAD_REQUEST,
                "This Bitcoin repayment invoice cannot accept payment in its current state"
                    .to_string(),
            ),
            Error::UserInJail => (StatusCode::BAD_REQUEST, "Invalid request".to_string()),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

impl From<approve_contract::Error> for Error {
    fn from(value: approve_contract::Error) -> Self {
        match value {
            approve_contract::Error::Database(e) => Error::database(e),
            approve_contract::Error::MissingLoanOffer { offer_id } => {
                Error::MissingLoanOffer { id: offer_id }
            }
            approve_contract::Error::MissingFiatLoanDetails => Error::MissingFiatLoanDetails,
            approve_contract::Error::ContractAddress(e) => Error::contract_address(e),
            approve_contract::Error::MissingBorrower => Error::MissingBorrower,
            approve_contract::Error::TrackContract(e) => Error::track_contract(e),
            approve_contract::Error::InvalidApproveRequest { status } => {
                Error::InvalidApproveRequest { status }
            }
            approve_contract::Error::MissingContractAddress => Error::MissingContractAddress,
            approve_contract::Error::MissingContract(contract_id) => {
                Error::MissingContract(contract_id)
            }
        }
    }
}

impl From<crate::contract_extension::Error> for Error {
    fn from(value: crate::contract_extension::Error) -> Self {
        match value {
            crate::contract_extension::Error::Database(e) => Error::database(e),
            crate::contract_extension::Error::InterestRateCalculation(e) => {
                Error::interest_rate_calculation(e)
            }
            crate::contract_extension::Error::MissingOriginationFee => Error::MissingOriginationFee,
            crate::contract_extension::Error::OriginationFeeCalculation(e) => {
                Error::origination_fee_calculation(e)
            }
            crate::contract_extension::Error::NotAllowed => Error::ExtensionNotAllowed,
            crate::contract_extension::Error::TooSoon => Error::ExtensionTooSoon,
            crate::contract_extension::Error::TooManyDays { max_duration_days } => {
                Error::ExtensionTooManyDays { max_duration_days }
            }
            crate::contract_extension::Error::ComputeExtensionInstallments(e) => {
                Error::ComputeExtensionInstallments(format!("{e:#}"))
            }
            crate::contract_extension::Error::ZeroLoanExtensionDuration => {
                Error::ZeroLoanExtensionDuration
            }
            crate::contract_extension::Error::MissingCollateralAddress => {
                Error::MissingCollateralAddress
            }
            crate::contract_extension::Error::TrackContract(e) => {
                Error::TrackContract(format!("{e:#}"))
            }
        }
    }
}

impl From<discounted_origination_fee::Error> for Error {
    fn from(value: discounted_origination_fee::Error) -> Self {
        match value {
            discounted_origination_fee::Error::InvalidDiscountRate { fee } => {
                Error::InvalidDiscountRate { fee }
            }
            discounted_origination_fee::Error::Database(sql_error) => {
                Error::database(anyhow!(sql_error))
            }
        }
    }
}

impl From<user_stats::Error> for Error {
    fn from(value: user_stats::Error) -> Self {
        match value {
            user_stats::Error::Database(e) => Error::database(anyhow!(e)),
        }
    }
}

impl From<bringin::Error> for Error {
    fn from(value: bringin::Error) -> Self {
        match value {
            bringin::Error::LoanAssetNotSupported {
                invalid_asset,
                supported_assets,
            } => Error::InvalidBringinAsset {
                invalid_asset,
                supported_assets,
            },
            bringin::Error::Database(e) => Self::database(e),
            bringin::Error::NoApiKey => Self::NoBringinApiKey,
            bringin::Error::LoanAmountOutOfBounds {
                min,
                max,
                loan_amount,
            } => Self::BringinLoanAmountOutOfBounds {
                min,
                max,
                loan_amount,
            },
            bringin::Error::RequestError(e) => Self::bringin(anyhow!(e)),
            bringin::Error::JsonError(e) => Self::bringin(anyhow!(e)),
            bringin::Error::ApiError { status, message } => {
                Self::bringin(anyhow!(format!("Bringin API error: {status}, {message}")))
            }
        }
    }
}

impl From<model::Installment> for Installment {
    fn from(value: model::Installment) -> Self {
        Self {
            id: value.id,
            principal: value.principal,
            interest: value.interest,
            due_date: value.due_date,
            status: value.status,
            paid_date: value.paid_date,
            payment_id: value.payment_id,
        }
    }
}

impl From<BitcoinInvoice> for BitcoinRepaymentInvoiceResponse {
    fn from(invoice: BitcoinInvoice) -> Self {
        Self {
            id: invoice.id,
            created_at: invoice.created_at,
            updated_at: invoice.updated_at,
            txid: invoice.txid.map(|t| t.to_string()),
            amount_sats: invoice.amount.to_sat(),
            amount_usd: invoice.amount_usd,
            installment_id: invoice.installment_id,
            address: invoice.address.into_unchecked(),
            expires_at: invoice.expires_at,
            status: invoice.status,
        }
    }
}
