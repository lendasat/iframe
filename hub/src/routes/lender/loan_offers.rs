use crate::db;
use crate::model::lender_feature_flags;
use crate::model::CreateLoanOfferSchema;
use crate::model::Lender;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanOfferStatus;
use crate::model::OriginationFee;
use crate::routes::borrower::contracts::LenderProfile;
use crate::routes::lender::auth;
use crate::routes::lender::AppState;
use anyhow::Context;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::delete;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/my-offers",
            get(get_loan_offers_by_lender).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .route(
            "/api/my-offers/:id",
            get(get_loan_offer_by_lender_and_offer_id).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .route(
            "/api/my-offers/:id",
            delete(delete_loan_offer_by_lender_and_offer_id).route_layer(
                middleware::from_fn_with_state(app_state.clone(), auth::jwt_auth::auth),
            ),
        )
        .route(
            "/api/my-offers/create",
            post(create_loan_offer).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .route(
            "/api/offers",
            get(get_loan_offers).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .route(
            "/api/offers/:id",
            get(get_loan_offer_by_id).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .route(
            "/api/offers/stats",
            get(get_latest_stats).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                auth::jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[instrument(skip_all, err(Debug))]
pub async fn create_loan_offer(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Json(body): Json<CreateLoanOfferSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    if body.min_ltv > dec!(1.0) || body.min_ltv < Decimal::zero() {
        let error_response = ErrorResponse {
            message: format!(
                "LTV needs to be between 0.00 and 1.00 but was {}",
                body.min_ltv
            ),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    if body.interest_rate > dec!(1.0) || body.interest_rate < Decimal::zero() {
        let error_response = ErrorResponse {
            message: format!(
                "Interest rate needs to be between 0.00 and 1.00 but was {}",
                body.interest_rate
            ),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let features = db::lender_features::load_lender_features(&data.db, user.id.clone())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    if features.iter().any(|feature| {
        body.auto_accept
            && feature.id == lender_feature_flags::AUTO_APPROVE_FEATURE_FLAG_ID
            && !feature.is_enabled
    }) {
        let error_response = ErrorResponse {
            message: "Auto approve feature is not enabled".to_string(),
        };
        return Err((StatusCode::UNAUTHORIZED, Json(error_response)));
    }

    let offer = db::loan_offers::insert_loan_offer(&data.db, body, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
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

    let origination_fee = data.config.origination_fee.clone();

    let offer = LoanOffer {
        id: offer.id,
        lender: LenderProfile {
            id: lender.id,
            name: lender.name,
        },
        name: offer.name,
        min_ltv: offer.min_ltv,
        interest_rate: offer.interest_rate,
        loan_amount_min: offer.loan_amount_min,
        loan_amount_max: offer.loan_amount_max,
        loan_amount_reserve: offer.loan_amount_reserve,
        loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
        duration_months_min: offer.duration_months_min,
        duration_months_max: offer.duration_months_max,
        loan_asset_type: offer.loan_asset_type,
        loan_asset_chain: offer.loan_asset_chain,
        status: offer.status,
        auto_accept: offer.auto_accept,
        loan_repayment_address: offer.loan_repayment_address,
        origination_fee,
        created_at: offer.created_at,
    };

    Ok((StatusCode::OK, Json(offer)))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoanOffer {
    pub id: String,
    pub lender: LenderProfile,
    pub name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub min_ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_max: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_reserve: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_reserve_remaining: Decimal,
    pub auto_accept: bool,
    pub duration_months_min: i32,
    pub duration_months_max: i32,
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
    pub status: LoanOfferStatus,
    pub loan_repayment_address: String,
    pub origination_fee: Vec<OriginationFee>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_offers_by_lender(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    // TODO: don't return the db object here but map it to a different one so that we can enhance it
    // with more data.
    let loans = db::loan_offers::load_all_loan_offers_by_lender(&data.db, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let mut ret = vec![];
    for offer in loans {
        let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
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

        let origination_fee = data.config.origination_fee.clone();

        let offer = LoanOffer {
            id: offer.id,
            lender: LenderProfile {
                id: lender.id,
                name: lender.name,
            },
            name: offer.name,
            min_ltv: offer.min_ltv,
            interest_rate: offer.interest_rate,
            loan_amount_min: offer.loan_amount_min,
            loan_amount_max: offer.loan_amount_max,
            duration_months_min: offer.duration_months_min,
            duration_months_max: offer.duration_months_max,
            loan_amount_reserve: offer.loan_amount_reserve,
            loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
            loan_asset_type: offer.loan_asset_type,
            loan_asset_chain: offer.loan_asset_chain,
            status: offer.status,
            auto_accept: offer.auto_accept,
            loan_repayment_address: offer.loan_repayment_address,
            origination_fee,
            created_at: offer.created_at,
        };
        ret.push(offer)
    }

    Ok((StatusCode::OK, Json(ret)))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_offer_by_lender_and_offer_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(offer_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let offer = db::loan_offers::get_loan_offer_by_lender_and_offer_id(
        &data.db,
        user.id.as_str(),
        offer_id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
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

    let origination_fee = data.config.origination_fee.clone();

    let loan = LoanOffer {
        id: offer.id,
        lender: LenderProfile {
            id: lender.id,
            name: lender.name,
        },
        name: offer.name,
        min_ltv: offer.min_ltv,
        interest_rate: offer.interest_rate,
        loan_amount_min: offer.loan_amount_min,
        loan_amount_max: offer.loan_amount_max,
        loan_amount_reserve: offer.loan_amount_reserve,
        loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
        duration_months_min: offer.duration_months_min,
        duration_months_max: offer.duration_months_max,
        loan_asset_type: offer.loan_asset_type,
        loan_asset_chain: offer.loan_asset_chain,
        status: offer.status,
        auto_accept: offer.auto_accept,
        loan_repayment_address: offer.loan_repayment_address,
        origination_fee,
        created_at: offer.created_at,
    };

    Ok((StatusCode::OK, Json(loan)))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_offers(
    State(data): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let loans = db::loan_offers::load_all_available_loan_offers(&data.db)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let mut ret = vec![];
    for offer in loans {
        let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
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

        let origination_fee = data.config.origination_fee.clone();

        ret.push(LoanOffer {
            id: offer.id,
            lender: LenderProfile {
                id: lender.id,
                name: lender.name,
            },
            name: offer.name,
            min_ltv: offer.min_ltv,
            interest_rate: offer.interest_rate,
            loan_amount_min: offer.loan_amount_min,
            loan_amount_max: offer.loan_amount_max,
            loan_amount_reserve: offer.loan_amount_reserve,
            loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
            duration_months_min: offer.duration_months_min,
            duration_months_max: offer.duration_months_max,
            loan_asset_type: offer.loan_asset_type,
            loan_asset_chain: offer.loan_asset_chain,
            status: offer.status,
            auto_accept: offer.auto_accept,
            loan_repayment_address: offer.loan_repayment_address,
            origination_fee,
            created_at: offer.created_at,
        })
    }

    Ok((StatusCode::OK, Json(ret)))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_offer_by_id(
    State(data): State<Arc<AppState>>,
    Path(offer_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let offer = db::loan_offers::loan_by_id(&data.db, offer_id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .ok_or_else(|| {
            let error_response = ErrorResponse {
                message: "Offer not found".to_string(),
            };
            (StatusCode::NOT_FOUND, Json(error_response))
        })?;

    let lender = db::lenders::get_user_by_id(&data.db, &offer.lender_id)
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

    let origination_fee = data.config.origination_fee.clone();

    let loan = LoanOffer {
        id: offer.id,
        lender: LenderProfile {
            id: lender.id,
            name: lender.name,
        },
        name: offer.name,
        min_ltv: offer.min_ltv,
        interest_rate: offer.interest_rate,
        loan_amount_min: offer.loan_amount_min,
        loan_amount_max: offer.loan_amount_max,
        loan_amount_reserve: offer.loan_amount_reserve,
        loan_amount_reserve_remaining: offer.loan_amount_reserve_remaining,
        duration_months_min: offer.duration_months_min,
        duration_months_max: offer.duration_months_max,
        loan_asset_type: offer.loan_asset_type,
        loan_asset_chain: offer.loan_asset_chain,
        status: offer.status,
        auto_accept: offer.auto_accept,
        loan_repayment_address: offer.loan_repayment_address,
        origination_fee,
        created_at: offer.created_at,
    };

    Ok((StatusCode::OK, Json(loan)))
}

#[instrument(skip_all, err(Debug))]
pub async fn delete_loan_offer_by_lender_and_offer_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
    Path(offer_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    db::loan_offers::mark_as_deleted_by_lender_and_offer_id(
        &data.db,
        user.id.as_str(),
        offer_id.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok((StatusCode::OK, ()))
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Serialize, Debug)]
pub struct LoanOfferStats {
    #[serde(with = "rust_decimal::serde::float")]
    avg: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    max: Decimal,
}

impl From<db::loan_offers::InterestRateStats> for LoanOfferStats {
    fn from(value: db::loan_offers::InterestRateStats) -> Self {
        Self {
            avg: value.avg,
            min: value.min,
            max: value.max,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct ContractStats {
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount: Decimal,
    duration_months: i32,
    #[serde(with = "rust_decimal::serde::float")]
    interest_rate: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

impl From<db::contracts::ContractStats> for ContractStats {
    fn from(value: db::contracts::ContractStats) -> Self {
        Self {
            loan_amount: value.loan_amount,
            duration_months: value.duration_months,
            interest_rate: value.interest_rate,
            created_at: value.created_at,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Stats {
    contract_stats: Vec<ContractStats>,
    loan_offer_stats: LoanOfferStats,
}

#[instrument(skip_all, err(Debug))]
pub async fn get_latest_stats(
    State(data): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let stats = db::loan_offers::calculate_loan_offer_stats(&data.db)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let loan_offer_stats = LoanOfferStats::from(stats);

    let latest_contract_stats = db::contracts::load_latest_contract_stats(&data.db, 10)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let contract_stats = latest_contract_stats
        .into_iter()
        .map(ContractStats::from)
        .collect::<Vec<_>>();

    Ok((
        StatusCode::OK,
        Json(Stats {
            contract_stats,
            loan_offer_stats,
        }),
    ))
}
