use crate::model;
use crate::model::db;
use crate::model::CreateLoanApplicationSchema;
use crate::model::LoanApplicationStatus;
use crate::model::LoanAsset;
use crate::model::LoanType;
use anyhow::Result;
use bitcoin::Address;
use rust_decimal::Decimal;
use sqlx::FromRow;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, FromRow, Clone)]
pub struct LoanApplication {
    pub loan_deal_id: String,
    pub borrower_id: String,
    pub ltv: Decimal,
    pub interest_rate: Decimal,
    pub loan_amount: Decimal,
    pub duration_days: i32,
    pub borrower_loan_address: Option<String>,
    pub borrower_btc_address: String,
    pub loan_asset: LoanAsset,
    pub loan_type: LoanType,
    pub borrower_pk: String,
    pub borrower_derivation_path: String,
    pub borrower_npub: String,
    pub status: LoanApplicationStatus,
    pub client_contract_id: Option<Uuid>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

impl From<LoanApplication> for model::LoanApplication {
    fn from(value: LoanApplication) -> Self {
        Self {
            loan_deal_id: value.loan_deal_id,
            borrower_id: value.borrower_id,
            ltv: value.ltv,
            interest_rate: value.interest_rate,
            loan_amount: value.loan_amount,
            duration_days: value.duration_days,
            borrower_loan_address: value.borrower_loan_address,
            borrower_btc_address: Address::from_str(value.borrower_btc_address.as_str())
                .expect("to be a valid address"),
            loan_asset: value.loan_asset,
            loan_type: value.loan_type,
            borrower_pk: value.borrower_pk.parse().expect("valid pk"),
            borrower_derivation_path: value.borrower_derivation_path.parse().expect("valid path"),
            borrower_npub: value.borrower_npub,
            status: value.status,
            client_contract_id: value.client_contract_id,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

pub(crate) async fn load_all_available_loan_applications(
    pool: &Pool<Postgres>,
) -> Result<Vec<model::LoanApplication>> {
    let loans = sqlx::query_as!(
        LoanApplication,
        r#"
        SELECT
            loan_deal_id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset AS "loan_asset: crate::model::LoanAsset",
            status AS "status: crate::model::LoanApplicationStatus",
            loan_type AS "loan_type: crate::model::db::LoanType",
            borrower_pk,
            borrower_derivation_path,
            borrower_loan_address,
            borrower_btc_address,
            borrower_npub,
            client_contract_id,
            created_at,
            updated_at
        FROM loan_applications
        WHERE status = 'Available'
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(loans
        .into_iter()
        .map(model::LoanApplication::from)
        .collect())
}

pub async fn load_all_loan_applications_by_borrower(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<Vec<model::LoanApplication>> {
    let loans = sqlx::query_as!(
        LoanApplication,
        r#"
        SELECT
            loan_deal_id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset AS "loan_asset: crate::model::LoanAsset",
            status AS "status: crate::model::LoanApplicationStatus",
            loan_type AS "loan_type: crate::model::db::LoanType",
            borrower_pk,
            borrower_derivation_path,
            borrower_loan_address,
            borrower_btc_address,
            borrower_npub,
            client_contract_id,
            created_at,
            updated_at
        FROM loan_applications
        WHERE borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_all(pool)
    .await?;

    Ok(loans
        .into_iter()
        .map(model::LoanApplication::from)
        .collect::<Vec<_>>())
}

pub async fn get_loan_application_by_borrower_and_application_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    loan_deal_id: &str,
) -> Result<Option<model::LoanApplication>> {
    let loan = sqlx::query_as!(
        LoanApplication,
        r#"
        SELECT
            loan_deal_id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset AS "loan_asset: crate::model::LoanAsset",
            status AS "status: crate::model::LoanApplicationStatus",
            loan_type AS "loan_type: crate::model::db::LoanType",
            borrower_pk,
            borrower_derivation_path,
            borrower_loan_address,
            borrower_btc_address,
            borrower_npub,
            client_contract_id,
            created_at,
            updated_at
        FROM loan_applications
        WHERE borrower_id = $1 and loan_deal_id = $2
        "#,
        borrower_id,
        loan_deal_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(loan.map(model::LoanApplication::from))
}

pub async fn mark_as_deleted_by_borrower_and_application_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    loan_deal_id: &str,
) -> Result<()> {
    sqlx::query_as!(
        LoanApplication,
        r#"
        UPDATE loan_applications set
            status = $1,
            updated_at = $2
        WHERE borrower_id = $3 and loan_deal_id = $4
        "#,
        LoanApplicationStatus::Deleted as LoanApplicationStatus,
        OffsetDateTime::now_utc(),
        borrower_id,
        loan_deal_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_loan_application(
    pool: &Pool<Postgres>,
    application: CreateLoanApplicationSchema,
    borrower_id: &str,
) -> Result<model::LoanApplication> {
    let mut tx = pool.begin().await?;

    let id = Uuid::new_v4().to_string();
    let status = LoanApplicationStatus::Available;

    let loan_type = db::LoanType::from(application.loan_type);

    // First, insert the loan deal.
    sqlx::query!(
        r#"
        INSERT INTO loan_deals (
          id,
          type,
          created_at
        )
        VALUES ($1, 'application', DEFAULT)
        "#,
        id,
    )
    .execute(&mut *tx)
    .await?;

    // Then insert the loan application
    let loan = sqlx::query_as!(
        LoanApplication,
        r#"
        INSERT INTO loan_applications (
            id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset,
            loan_type,
            borrower_pk,
            borrower_derivation_path,
            borrower_loan_address,
            borrower_btc_address,
            borrower_npub,
            client_contract_id,
            status,
            loan_deal_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $1)
        RETURNING
            loan_deal_id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset AS "loan_asset: crate::model::LoanAsset",
            loan_type AS "loan_type: crate::model::db::LoanType",
            status AS "status: crate::model::LoanApplicationStatus",
            borrower_pk,
            borrower_derivation_path,
            borrower_loan_address,
            borrower_btc_address,
            borrower_npub,
            client_contract_id,
            created_at,
            updated_at
        "#,
        id,
        borrower_id,
        application.ltv,
        application.interest_rate,
        application.loan_amount,
        application.duration_days,
        application.loan_asset as LoanAsset,
        loan_type as db::LoanType,
        application.borrower_pk.to_string(),
        application.borrower_derivation_path.to_string(),
        application.borrower_loan_address,
        application
            .borrower_btc_address
            .assume_checked()
            .to_string(),
        application.borrower_npub,
        application.client_contract_id,
        status as LoanApplicationStatus,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(model::LoanApplication::from(loan))
}

pub async fn get_loan_by_id(
    db: &Pool<Postgres>,
    loan_deal_id: &str,
) -> Result<Option<model::LoanApplication>> {
    let loan = sqlx::query_as!(
        LoanApplication,
        r#"
        SELECT
            loan_deal_id,
            borrower_id,
            ltv,
            interest_rate,
            loan_amount,
            duration_days,
            loan_asset AS "loan_asset: crate::model::LoanAsset",
            status AS "status: crate::model::LoanApplicationStatus",
            loan_type AS "loan_type: crate::model::db::LoanType",
            borrower_pk,
            borrower_derivation_path,
            borrower_loan_address,
            borrower_btc_address,
            borrower_npub,
            client_contract_id,
            created_at,
            updated_at
        FROM loan_applications
        WHERE loan_deal_id = $1
        "#,
        loan_deal_id
    )
    .fetch_optional(db)
    .await?;

    Ok(loan.map(model::LoanApplication::from))
}

pub async fn mark_as_taken_by_borrower_and_application_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    application_id: &str,
) -> Result<()> {
    sqlx::query_as!(
        LoanApplication,
        r#"
        UPDATE loan_applications set
            status = $1,
            updated_at = $2
        WHERE borrower_id = $3 and loan_deal_id = $4
        "#,
        LoanApplicationStatus::Taken as LoanApplicationStatus,
        OffsetDateTime::now_utc(),
        borrower_id,
        application_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Clone)]
pub struct ExpiredApplication {
    pub application_id: String,
    pub borrower_id: String,
}

/// Expires open loan applications if the borrower has not logged in a single time in the last
/// [expiry_in_hours]
pub(crate) async fn expire_loan_applications(
    pool: &Pool<Postgres>,
    expiry_in_hours: i64,
) -> Result<Vec<ExpiredApplication>> {
    let expiration_threshold = OffsetDateTime::now_utc() - time::Duration::hours(expiry_in_hours);

    let expired = sqlx::query_as!(
        ExpiredApplication,
        r#"
        UPDATE
            loan_applications
        SET
            status = 'ApplicationExpired',
            updated_at = $1
        WHERE
            status = 'Available' AND
            created_at <= $2 AND
            borrower_id IN (
                SELECT la.borrower_id
                FROM loan_applications la
                LEFT JOIN (
                    SELECT borrower_id, MAX(created_at) as last_login
                    FROM borrower_login_activity
                    GROUP BY borrower_id
                ) bla ON la.borrower_id = bla.borrower_id
                WHERE la.status = 'Available' AND
                      (bla.last_login IS NULL OR bla.last_login <= $3)
            )
        RETURNING
            id as "application_id",
            borrower_id as "borrower_id"
    "#,
        OffsetDateTime::now_utc(),
        expiration_threshold,
        expiration_threshold
    )
    .fetch_all(pool)
    .await?;
    Ok(expired)
}
