use crate::model::CreateLoanOfferSchema;
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
            duration_months_min,
            duration_months_max,
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanOfferStatus",
            loan_repayment_address,
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

pub async fn load_all_loan_offers_by_lender(
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
            duration_months_min,
            duration_months_max,
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanOfferStatus",
            loan_repayment_address,
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

pub async fn insert_loan_offer(
    pool: &Pool<Postgres>,
    offer: CreateLoanOfferSchema,
    lender_id: String,
) -> Result<LoanOffer> {
    let id = uuid::Uuid::new_v4().to_string();
    let status = LoanOfferStatus::Available;

    let loan = sqlx::query_as!(
        LoanOffer,
        r#"
        INSERT INTO loan_offers (
          id,
          lender_id,
          name,
          min_ltv,
          interest_rate,
          loan_amount_min,
          loan_amount_max,
          duration_months_min,
          duration_months_max,
          loan_asset_type,
          loan_asset_chain,
          status,
          loan_repayment_address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING
          id,
          lender_id,
          name,
          min_ltv,
          interest_rate,
          loan_amount_min,
          loan_amount_max,
          duration_months_min,
          duration_months_max,
          loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
          loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
          status AS "status: crate::model::LoanOfferStatus",
          loan_repayment_address,
          created_at,
          updated_at
        "#,
        id,
        lender_id,
        offer.name,
        offer.min_ltv,
        offer.interest_rate,
        offer.loan_amount_min,
        offer.loan_amount_max,
        offer.duration_months_min,
        offer.duration_months_max,
        offer.loan_asset_type as LoanAssetType,
        offer.loan_asset_chain as LoanAssetChain,
        status as LoanOfferStatus,
        offer.loan_repayment_address
    )
    .fetch_one(pool)
    .await?;

    Ok(loan)
}

pub(crate) async fn loan_by_id(
    pool: &Pool<Postgres>,
    loan_id: String,
) -> Result<Option<LoanOffer>> {
    let loan = sqlx::query_as!(
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
            duration_months_min,
            duration_months_max,
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanOfferStatus",
            loan_repayment_address,
            created_at,
            updated_at
        FROM loan_offers
        WHERE id = $1
        "#,
        loan_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(loan)
}
