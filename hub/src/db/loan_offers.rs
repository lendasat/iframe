use crate::model::CreateLoanOfferSchema;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanOffer;
use crate::model::LoanOfferStatus;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;

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
    lender_id: &str,
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
pub async fn get_loan_offer_by_lender_and_offer_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
    offer_id: &str,
) -> Result<LoanOffer> {
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
        WHERE lender_id = $1 and id = $2
        "#,
        lender_id,
        offer_id
    )
    .fetch_one(pool)
    .await?;

    Ok(loan)
}

pub async fn mark_as_deleted_by_lender_and_offer_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
    offer_id: &str,
) -> Result<()> {
    sqlx::query_as!(
        LoanOffer,
        r#"
        UPDATE loan_offers set 
            status = $1,
            updated_at = $2
        WHERE lender_id = $3 and id = $4
        "#,
        LoanOfferStatus::Deleted as LoanOfferStatus,
        OffsetDateTime::now_utc(),
        lender_id,
        offer_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_loan_offer(
    pool: &Pool<Postgres>,
    offer: CreateLoanOfferSchema,
    lender_id: &str,
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

pub(crate) async fn loan_by_id(pool: &Pool<Postgres>, loan_id: &str) -> Result<Option<LoanOffer>> {
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
