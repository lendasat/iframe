use crate::model::LoanOffer;
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
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanOfferStatus",
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

pub(crate) async fn load_all_loan_offers_by_lender(
    pool: &Pool<Postgres>,
    lender_id: String,
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
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanOfferStatus",
            created_at,
            updated_at
        FROM loan_offers
        WHERE lender_id = $1
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    Ok(loans)
}
