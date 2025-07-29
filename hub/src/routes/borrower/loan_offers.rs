use crate::db;
use crate::model::LoanAsset;
use crate::model::LoanOfferStatus;
use crate::model::LoanPayout;
use crate::model::OriginationFee;
use crate::model::RepaymentPlan;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::LOAN_OFFERS_TAG;
use crate::routes::AppState;
use crate::user_stats;
use crate::user_stats::LenderStats;
use anyhow::anyhow;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Json;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use url::Url;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_all_available_loan_offers))
        .routes(routes!(get_loan_offer))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .routes(routes!(get_available_loan_offers_by_lender))
        .with_state(app_state)
}

/// Get all available loan offers.
#[utoipa::path(
get,
path = "/",
tag = LOAN_OFFERS_TAG,
params(
    ("loan_type" = Option<QueryParamLoanType>, Query, description = "Filter by loan type: Direct, Indirect, or All. Defaults to Direct if not provided."),
    ("asset_type" = Option<AssetTypeFilter>, Query, description = "Filter by asset type: fiat, stable_coins, or all"),
    ("loan_assets" = Option<String>, Query, description = "Filter by specific loan assets (comma-separated list, e.g., 'UsdcPol,UsdtPol')"),
    ("kyc" = Option<KycFilter>, Query, description = "Filter by KYC requirement: no_kyc, with_kyc, or all"),
    ("min_loan_amount" = Option<Decimal>, Query, description = "Minimum loan amount"),
    ("max_loan_amount" = Option<Decimal>, Query, description = "Maximum loan amount"),
    ("max_interest_rate" = Option<Decimal>, Query, description = "Maximum yearly interest rate (e.g., 0.12 for 12%)"),
    ("duration_min" = Option<i32>, Query, description = "Minimum duration in days"),
    ("duration_max" = Option<i32>, Query, description = "Maximum duration in days")
),
responses(
    (
    status = 200,
    description = "A list of available offers",
    body = [LoanOffer]
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn get_all_available_loan_offers(
    State(data): State<Arc<AppState>>,
    Query(query): Query<LoanOffersQuery>,
) -> Result<AppJson<Vec<LoanOffer>>, Error> {
    let loans = db::loan_offers::load_all_available_loan_offers(&data.db)
        .await
        .map_err(Error::database)?;

    let mut ret = vec![];

    let filter_by = query.loan_type.unwrap_or(QueryParamLoanType::Direct);

    for loan_offer in loans {
        // Apply loan type filter
        match filter_by {
            QueryParamLoanType::Direct => {
                if loan_offer.loan_payout != LoanPayout::Direct {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::Indirect => {
                if loan_offer.loan_payout != LoanPayout::Indirect {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::All => {
                // we take all offers
            }
            QueryParamLoanType::MoonCardInstant => {
                if loan_offer.loan_payout != LoanPayout::MoonCardInstant {
                    continue; // Skip this offer
                }
            }
        }

        // Apply additional filters
        if !query.matches_filters(&loan_offer) {
            continue;
        }

        let lender = db::lenders::get_user_by_id(&data.db, &loan_offer.lender_id)
            .await
            .map_err(Error::database)?
            .ok_or(Error::MissingLender)?;

        // TODO: filter available origination fees once we have more than one
        let origination_fee = data.config.origination_fee.clone();

        let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
            .await
            .map_err(|e| Error::database(anyhow!("{e:?}")))?;

        ret.push(LoanOffer {
            id: loan_offer.loan_deal_id,
            lender: lender_stats,
            name: loan_offer.name,
            min_ltv: loan_offer.min_ltv,
            interest_rate: loan_offer.interest_rate,
            loan_amount_min: loan_offer.loan_amount_min,
            loan_amount_max: loan_offer.loan_amount_max,
            duration_days_min: loan_offer.duration_days_min,
            duration_days_max: loan_offer.duration_days_max,
            loan_asset: loan_offer.loan_asset,
            loan_payout: loan_offer.loan_payout,
            status: loan_offer.status,
            loan_repayment_address: loan_offer.loan_repayment_address,
            origination_fee,
            kyc_link: loan_offer.kyc_link,
            lender_pk: loan_offer.lender_pk,
            repayment_plan: loan_offer.repayment_plan,
        })
    }

    Ok(AppJson(ret))
}

/// Get all the loan offers of a given lender.
#[utoipa::path(
get,
path = "/by-lender/{id}",
params(
    ("loan_type" = Option<QueryParamLoanType>, Query, description = "Filter by loan type: Direct, Indirect, or All. Defaults to Direct if not provided."),
    ("asset_type" = Option<AssetTypeFilter>, Query, description = "Filter by asset type: fiat, stable_coins, or all"),
    ("loan_assets" = Option<String>, Query, description = "Filter by specific loan assets (comma-separated list, e.g., 'UsdcPol,UsdtPol')"),
    ("kyc" = Option<KycFilter>, Query, description = "Filter by KYC requirement: no_kyc, with_kyc, or all"),
    ("min_loan_amount" = Option<Decimal>, Query, description = "Minimum loan amount"),
    ("max_loan_amount" = Option<Decimal>, Query, description = "Maximum loan amount"),
    ("max_interest_rate" = Option<Decimal>, Query, description = "Maximum yearly interest rate (e.g., 0.12 for 12%)"),
    ("duration_min" = Option<i32>, Query, description = "Minimum duration in days"),
    ("duration_max" = Option<i32>, Query, description = "Maximum duration in days"),
    ("id" = String, Path, description = "Lender ID")
),
tag = LOAN_OFFERS_TAG,
responses(
    (
    status = 200,
    description = "A list of loan offers created by the given lender",
    body = [LoanOffer]
    )
),
)
]
#[instrument(skip_all, err(Debug))]
async fn get_available_loan_offers_by_lender(
    State(data): State<Arc<AppState>>,
    Path(lender_id): Path<String>,
    Query(query): Query<LoanOffersQuery>,
) -> Result<AppJson<Vec<LoanOffer>>, Error> {
    let available_loans =
        db::loan_offers::load_available_loan_offers_by_lender(&data.db, lender_id.as_str())
            .await
            .map_err(Error::database)?;

    let mut ret = vec![];

    let lender = db::lenders::get_user_by_id(&data.db, &lender_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    let filter_by = query.loan_type.unwrap_or(QueryParamLoanType::Direct);

    for loan_offer in available_loans {
        // Apply loan type filter
        match filter_by {
            QueryParamLoanType::Direct => {
                if loan_offer.loan_payout != LoanPayout::Direct {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::Indirect => {
                if loan_offer.loan_payout != LoanPayout::Indirect {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::MoonCardInstant => {
                if loan_offer.loan_payout != LoanPayout::MoonCardInstant {
                    continue; // Skip this offer
                }
            }
            QueryParamLoanType::All => {
                // we take all offers
            }
        }

        // Apply additional filters
        if !query.matches_filters(&loan_offer) {
            continue;
        }
        // TODO: filter available origination fees once we have more than one
        let origination_fee = data.config.origination_fee.clone();

        let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
            .await
            .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

        ret.push(LoanOffer {
            id: loan_offer.loan_deal_id,
            lender: lender_stats,
            name: loan_offer.name,
            min_ltv: loan_offer.min_ltv,
            interest_rate: loan_offer.interest_rate,
            loan_amount_min: loan_offer.loan_amount_min,
            loan_amount_max: loan_offer.loan_amount_max,
            duration_days_min: loan_offer.duration_days_min,
            duration_days_max: loan_offer.duration_days_max,
            loan_asset: loan_offer.loan_asset,
            loan_payout: loan_offer.loan_payout,
            status: loan_offer.status,
            loan_repayment_address: loan_offer.loan_repayment_address,
            origination_fee,
            kyc_link: loan_offer.kyc_link,
            lender_pk: loan_offer.lender_pk,
            repayment_plan: loan_offer.repayment_plan,
        })
    }

    Ok(AppJson(ret))
}

/// Get a specific loan offer.
#[utoipa::path(
get,
path = "/{id}",
params(
    ("id" = String, Path, description = "Loan offer ID"),
    ("loan_type" = Option<QueryParamLoanType>, Query, description = "Filter by loan type: Direct, Indirect, or All"),
    ("asset_type" = Option<AssetTypeFilter>, Query, description = "Filter by asset type: fiat, stable_coins, or all"),
    ("loan_assets" = Option<String>, Query, description = "Filter by specific loan assets (comma-separated list, e.g., 'UsdcPol,UsdtPol')"),
    ("kyc" = Option<KycFilter>, Query, description = "Filter by KYC requirement: no_kyc, with_kyc, or all"),
    ("min_loan_amount" = Option<Decimal>, Query, description = "Minimum loan amount"),
    ("max_loan_amount" = Option<Decimal>, Query, description = "Maximum loan amount"),
    ("max_interest_rate" = Option<Decimal>, Query, description = "Maximum yearly interest rate (e.g., 0.12 for 12%)"),
    ("duration_min" = Option<i32>, Query, description = "Minimum duration in days"),
    ("duration_max" = Option<i32>, Query, description = "Maximum duration in days")
),
tag = LOAN_OFFERS_TAG,
responses(
    (
    status = 200,
    description = "A loan offer",
    body = LoanOffer
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn get_loan_offer(
    State(data): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<LoanOffersQuery>,
) -> Result<AppJson<LoanOffer>, Error> {
    let loan = db::loan_offers::loan_by_id(&data.db, id.as_str())
        .await
        .map_err(Error::database)?;

    let loan_offer = loan.ok_or(Error::MissingLoanOffer)?;

    // Apply filters - if the loan offer doesn't match the filters, return not found
    if !query.matches_filters(&loan_offer) {
        return Err(Error::MissingLoanOffer);
    }
    let lender = db::lenders::get_user_by_id(&data.db, &loan_offer.lender_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLender)?;

    // TODO: filter available origination fees once we have more than one
    let origination_fee = data.config.origination_fee.clone();

    let lender_stats = user_stats::get_lender_stats(&data.db, lender.id.as_str())
        .await
        .map_err(|e| Error::database(anyhow!("{:?}", e)))?;

    Ok(AppJson(LoanOffer {
        id: loan_offer.loan_deal_id,
        lender: lender_stats,
        name: loan_offer.name,
        min_ltv: loan_offer.min_ltv,
        interest_rate: loan_offer.interest_rate,
        loan_amount_min: loan_offer.loan_amount_min,
        loan_amount_max: loan_offer.loan_amount_max,
        duration_days_min: loan_offer.duration_days_min,
        duration_days_max: loan_offer.duration_days_max,
        loan_asset: loan_offer.loan_asset,
        loan_payout: loan_offer.loan_payout,
        status: loan_offer.status,
        loan_repayment_address: loan_offer.loan_repayment_address,
        origination_fee,
        kyc_link: loan_offer.kyc_link,
        lender_pk: loan_offer.lender_pk,
        repayment_plan: loan_offer.repayment_plan,
    }))
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
struct LoanOffer {
    id: String,
    lender: LenderStats,
    name: String,
    #[serde(with = "rust_decimal::serde::float")]
    min_ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount_min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount_max: Decimal,
    duration_days_min: i32,
    duration_days_max: i32,
    loan_asset: LoanAsset,
    loan_payout: LoanPayout,
    status: LoanOfferStatus,
    loan_repayment_address: String,
    origination_fee: Vec<OriginationFee>,
    kyc_link: Option<Url>,
    #[schema(value_type = String)]
    lender_pk: PublicKey,
    repayment_plan: RepaymentPlan,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone, Copy)]
#[serde(rename_all = "PascalCase")]
pub enum QueryParamLoanType {
    /// Filter for direct loan offers only.
    Direct,
    /// Filter for indirect loan offers only.
    Indirect,
    /// Filter for instant Moon card offers only.
    MoonCardInstant,
    /// Show all loan offers (both direct and indirect).
    All,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Default)]
#[serde(default)]
struct LoanOffersQuery {
    loan_type: Option<QueryParamLoanType>,
    /// Filter by asset type: fiat, stable_coins, or all
    asset_type: Option<AssetTypeFilter>,
    /// Filter by specific loan assets (comma-separated list)
    loan_assets: Option<String>,
    /// Filter by KYC requirement: no_kyc, with_kyc, or all
    kyc: Option<KycFilter>,
    /// Minimum loan amount
    #[serde(with = "rust_decimal::serde::float_option")]
    min_loan_amount: Option<Decimal>,
    /// Maximum interest rate (yearly)
    #[serde(with = "rust_decimal::serde::float_option")]
    max_interest_rate: Option<Decimal>,
    /// Minimum duration in days
    duration_min: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum AssetTypeFilter {
    Fiat,
    StableCoins,
    All,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum KycFilter {
    NoKyc,
    WithKyc,
    All,
}

impl LoanOffersQuery {
    fn parse_loan_assets(&self) -> Option<Vec<LoanAsset>> {
        self.loan_assets.as_ref().map(|assets| {
            assets
                .split(',')
                .filter_map(|asset| match asset.trim() {
                    "UsdcPol" => Some(LoanAsset::UsdcPol),
                    "UsdtPol" => Some(LoanAsset::UsdtPol),
                    "UsdcEth" => Some(LoanAsset::UsdcEth),
                    "UsdtEth" => Some(LoanAsset::UsdtEth),
                    "UsdcStrk" => Some(LoanAsset::UsdcStrk),
                    "UsdtStrk" => Some(LoanAsset::UsdtStrk),
                    "UsdcSol" => Some(LoanAsset::UsdcSol),
                    "UsdtSol" => Some(LoanAsset::UsdtSol),
                    "Usd" => Some(LoanAsset::Usd),
                    "Eur" => Some(LoanAsset::Eur),
                    "Chf" => Some(LoanAsset::Chf),
                    "Mxn" => Some(LoanAsset::Mxn),
                    "UsdtLiquid" => Some(LoanAsset::UsdtLiquid),
                    _ => None,
                })
                .collect()
        })
    }

    fn matches_filters(&self, loan_offer: &crate::model::LoanOffer) -> bool {
        // Asset type filter
        if let Some(asset_type) = &self.asset_type {
            match asset_type {
                AssetTypeFilter::Fiat => {
                    if !loan_offer.loan_asset.is_fiat() {
                        return false;
                    }
                }
                AssetTypeFilter::StableCoins => {
                    if loan_offer.loan_asset.is_fiat() {
                        return false;
                    }
                }
                AssetTypeFilter::All => {}
            }
        }

        // Specific loan assets filter
        if let Some(assets) = self.parse_loan_assets() {
            if !assets.contains(&loan_offer.loan_asset) {
                return false;
            }
        }

        // KYC filter
        if let Some(kyc_filter) = &self.kyc {
            match kyc_filter {
                KycFilter::NoKyc => {
                    if loan_offer.kyc_link.is_some() {
                        return false;
                    }
                }
                KycFilter::WithKyc => {
                    if loan_offer.kyc_link.is_none() {
                        return false;
                    }
                }
                KycFilter::All => {}
            }
        }

        // Loan amount filters
        if let Some(min_amount) = self.min_loan_amount {
            if loan_offer.loan_amount_max < min_amount || loan_offer.loan_amount_min > min_amount {
                return false;
            }
        }

        // Interest rate filter
        if let Some(max_rate) = self.max_interest_rate {
            if loan_offer.interest_rate > max_rate {
                return false;
            }
        }

        // Duration filters
        if let Some(duration_min) = self.duration_min {
            if loan_offer.duration_days_max < duration_min
                || loan_offer.duration_days_min > duration_min
            {
                return false;
            }
        }

        true
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

// Error fields are allowed to be dead code because they are actually used when printed in logs.
/// All the errors related to the `loan_offers` REST API.
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Referenced lender does not exist.
    MissingLender,
    /// Loan offer not found.
    MissingLoanOffer,
}

impl Error {
    fn database(e: anyhow::Error) -> Self {
        Self::Database(format!("{e:#}"))
    }
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

/// Tell `axum` how [`Error`] should be converted into a response.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::JsonRejection(rejection) => {
                // This error is caused by bad user input so don't log it
                (rejection.status(), rejection.body_text())
            }
            Error::Database(_) | Error::MissingLender => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::MissingLoanOffer => (StatusCode::BAD_REQUEST, "Loan offer not found".to_owned()),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ExtensionPolicy;
    use crate::model::LoanOffer;
    use crate::model::LoanOfferStatus;
    use crate::model::Npub;
    use bitcoin::PublicKey;
    use rust_decimal_macros::dec;
    use std::str::FromStr;
    use time::macros::datetime;

    fn create_test_loan_offer() -> LoanOffer {
        LoanOffer {
            loan_deal_id: "test-loan-deal-id".to_string(),
            lender_id: "test-lender-id".to_string(),
            name: "Test Loan Offer".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.10),
            loan_amount_min: dec!(1000),
            loan_amount_max: dec!(10000),
            loan_amount_reserve: dec!(50000),
            loan_amount_reserve_remaining: dec!(50000),
            duration_days_min: 30,
            duration_days_max: 360,
            loan_asset: LoanAsset::UsdcPol,
            loan_payout: LoanPayout::Direct,
            status: LoanOfferStatus::Available,
            loan_repayment_address: "0x1234567890abcdef".to_string(),
            lender_pk: PublicKey::from_str(
                "02afddf59ddf612bc0aee80dee376fb5cdf9def3f08863963896f9edbe8f600dda",
            )
            .unwrap(),
            lender_derivation_path: "m/0/0".parse().unwrap(),
            auto_accept: false,
            kyc_link: None,
            lender_npub: Npub::from_str(
                "npub17mx98j4khcynw7cm6m0zfu5q2uv6dqs2lenaq8nfzn8paz5dt4hqs5utwq",
            )
            .unwrap(),
            extension_policy: ExtensionPolicy::DoNotExtend,
            repayment_plan: RepaymentPlan::Bullet,
            btc_loan_repayment_address: None,
            created_at: datetime!(2024-01-01 0:00 UTC),
            updated_at: datetime!(2024-01-01 0:00 UTC),
        }
    }

    #[test]
    fn test_parse_loan_assets() {
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: Some("UsdcPol,UsdtEth,Usd".to_string()),
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };

        let assets = query.parse_loan_assets().unwrap();
        assert_eq!(assets.len(), 3);
        assert!(assets.contains(&LoanAsset::UsdcPol));
        assert!(assets.contains(&LoanAsset::UsdtEth));
        assert!(assets.contains(&LoanAsset::Usd));
    }

    #[test]
    fn test_parse_loan_assets_with_spaces() {
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: Some("UsdcPol, UsdtEth , Usd".to_string()),
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };

        let assets = query.parse_loan_assets().unwrap();
        assert_eq!(assets.len(), 3);
    }

    #[test]
    fn test_parse_loan_assets_invalid() {
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: Some("UsdcPol,InvalidAsset,UsdtEth".to_string()),
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };

        let assets = query.parse_loan_assets().unwrap();
        assert_eq!(assets.len(), 2); // Only valid assets are included
        assert!(assets.contains(&LoanAsset::UsdcPol));
        assert!(assets.contains(&LoanAsset::UsdtEth));
    }

    #[test]
    fn test_matches_filters_asset_type_fiat() {
        let mut loan_offer = create_test_loan_offer();
        loan_offer.loan_asset = LoanAsset::Usd;

        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: Some(AssetTypeFilter::Fiat),
            loan_assets: None,
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };

        assert!(query.matches_filters(&loan_offer));
    }

    #[test]
    fn test_matches_filters_asset_type_stable_coins() {
        let mut loan_offer = create_test_loan_offer();
        loan_offer.loan_asset = LoanAsset::UsdcPol;

        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: Some(AssetTypeFilter::StableCoins),
            loan_assets: None,
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };

        assert!(query.matches_filters(&loan_offer));
    }

    #[test]
    fn test_matches_filters_specific_loan_assets() {
        let mut loan_offer = create_test_loan_offer();
        loan_offer.loan_asset = LoanAsset::UsdcPol;

        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: Some("UsdcPol,UsdtPol".to_string()),
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };

        assert!(query.matches_filters(&loan_offer));

        // Test with asset not in list
        loan_offer.loan_asset = LoanAsset::UsdcEth;
        assert!(!query.matches_filters(&loan_offer));
    }

    #[test]
    fn test_matches_filters_kyc() {
        let mut loan_offer = create_test_loan_offer();

        // Test NoKyc filter with no KYC link
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: Some(KycFilter::NoKyc),
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };
        assert!(query.matches_filters(&loan_offer));

        // Add KYC link
        loan_offer.kyc_link = Some("https://kyc.example.com".parse().unwrap());
        assert!(!query.matches_filters(&loan_offer));

        // Test WithKyc filter
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: Some(KycFilter::WithKyc),
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: None,
        };
        assert!(query.matches_filters(&loan_offer));
    }

    #[test]
    fn test_matches_filters_loan_amount() {
        let loan_offer = create_test_loan_offer();

        // Test min amount within range
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: Some(dec!(5000)),
            max_interest_rate: None,
            duration_min: None,
        };
        assert!(query.matches_filters(&loan_offer));

        // Test min amount above max
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: Some(dec!(15000)),
            max_interest_rate: None,
            duration_min: None,
        };
        assert!(!query.matches_filters(&loan_offer));

        // Test min amount below min
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: Some(dec!(500)),
            max_interest_rate: None,
            duration_min: None,
        };
        assert!(!query.matches_filters(&loan_offer));
    }

    #[test]
    fn test_matches_filters_interest_rate() {
        let mut loan_offer = create_test_loan_offer();
        loan_offer.interest_rate = dec!(0.15);

        // Test with rate below loan's rate
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: Some(dec!(0.12)),
            duration_min: None,
        };
        assert!(!query.matches_filters(&loan_offer));

        // Test with rate above loan's rate
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: Some(dec!(0.20)),
            duration_min: None,
        };
        assert!(query.matches_filters(&loan_offer));
    }

    #[test]
    fn test_matches_filters_duration() {
        let loan_offer = create_test_loan_offer();

        // Test duration within range
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: Some(60),
        };
        assert!(query.matches_filters(&loan_offer));

        // Test duration above max
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: Some(400),
        };
        assert!(!query.matches_filters(&loan_offer));

        // Test duration below min
        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: None,
            loan_assets: None,
            kyc: None,
            min_loan_amount: None,
            max_interest_rate: None,
            duration_min: Some(15),
        };
        assert!(!query.matches_filters(&loan_offer));
    }

    #[test]
    fn test_matches_filters_combined() {
        let mut loan_offer = create_test_loan_offer();
        loan_offer.loan_asset = LoanAsset::UsdcPol;
        loan_offer.interest_rate = dec!(0.08);
        loan_offer.kyc_link = None;

        let query = LoanOffersQuery {
            loan_type: None,
            asset_type: Some(AssetTypeFilter::StableCoins),
            loan_assets: Some("UsdcPol,UsdtPol".to_string()),
            kyc: Some(KycFilter::NoKyc),
            min_loan_amount: Some(dec!(2000)),
            max_interest_rate: Some(dec!(0.10)),
            duration_min: Some(60),
        };

        assert!(query.matches_filters(&loan_offer));

        // Change one condition to fail
        loan_offer.interest_rate = dec!(0.12);
        assert!(!query.matches_filters(&loan_offer));
    }
}
