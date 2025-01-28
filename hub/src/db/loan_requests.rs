use crate::model::CreateLoanRequestSchema;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use crate::model::LoanRequest;
use crate::model::LoanRequestStatus;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;

pub(crate) async fn load_all_available_loan_requests(
    pool: &Pool<Postgres>,
) -> Result<Vec<LoanRequest>> {
    let loans = sqlx::query_as!(
        LoanRequest,
        r#"
        SELECT
            id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanRequestStatus",
            created_at,
            updated_at
        FROM loan_requests
        WHERE status = 'Available'
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(loans)
}

pub async fn load_all_loan_requests_by_borrower(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<Vec<LoanRequest>> {
    let loans = sqlx::query_as!(
        LoanRequest,
        r#"
        SELECT
            id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanRequestStatus",
            created_at,
            updated_at
        FROM loan_requests
        WHERE borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_all(pool)
    .await?;

    Ok(loans)
}

pub async fn get_loan_request_by_borrower_and_request_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    request_id: &str,
) -> Result<LoanRequest> {
    let loan = sqlx::query_as!(
        LoanRequest,
        r#"
        SELECT
            id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanRequestStatus",
            created_at,
            updated_at
        FROM loan_requests
        WHERE borrower_id = $1 and id = $2
        "#,
        borrower_id,
        request_id
    )
    .fetch_one(pool)
    .await?;

    Ok(loan)
}

pub async fn mark_as_deleted_by_borrower_and_request_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    request_id: &str,
) -> Result<()> {
    sqlx::query_as!(
        LoanRequest,
        r#"
        UPDATE loan_requests set
            status = $1,
            updated_at = $2
        WHERE borrower_id = $3 and id = $4
        "#,
        LoanRequestStatus::Deleted as LoanRequestStatus,
        OffsetDateTime::now_utc(),
        borrower_id,
        request_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_loan_request(
    pool: &Pool<Postgres>,
    request: CreateLoanRequestSchema,
    borrower_id: &str,
) -> Result<LoanRequest> {
    let id = uuid::Uuid::new_v4().to_string();
    let status = LoanRequestStatus::Available;

    let loan = sqlx::query_as!(
        LoanRequest,
        r#"
        INSERT INTO loan_requests (
            id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset_type,
            loan_asset_chain,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
            id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset_type AS "loan_asset_type: crate::model::LoanAssetType",
            loan_asset_chain AS "loan_asset_chain: crate::model::LoanAssetChain",
            status AS "status: crate::model::LoanRequestStatus",
            created_at,
            updated_at
        "#,
        id,
        borrower_id,
        request.ltv,
        request.interest_rate,
        request.loan_amount,
        request.duration_days,
        request.loan_asset_type as LoanAssetType,
        request.loan_asset_chain as LoanAssetChain,
        status as LoanRequestStatus,
    )
    .fetch_one(pool)
    .await?;

    Ok(loan)
}
