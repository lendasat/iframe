use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanOffer;
use crate::model::LoanOfferStatus;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

pub(crate) async fn load_all_available_loan_offers(
    pool: &Pool<Postgres>,
) -> Result<Vec<LoanOffer>> {
    let loans = sqlx::query_as!(
        LoanOffer,
        r#"
        SELECT
            id,
            lender_id,
            name,
            min_ltv,
            interest_rate,
            loan_amount_min,
            loan_amount_max,
            loan_asset_type AS "loan_asset_type: LoanAssetType", 
            loan_asset_chain AS "loan_asset_chain: LoanAssetChain", 
            status AS "status: LoanOfferStatus", 
            created_at,
            updated_at
        FROM loan_offers
        WHERE status = 'Available'
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(loans)
}
