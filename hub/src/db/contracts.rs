use crate::model::Contract;
use anyhow::bail;
use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn load_contracts_by_borrower_id(
    pool: &Pool<Postgres>,
    id: &str,
) -> Result<Vec<Contract>> {
    // we can't use query_as! here because postgres does not support u64
    let rows = sqlx::query!(
        r#"
        SELECT 
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            status as "status: crate::model::ContractStatus",
            duration_months,
            created_at,
            updated_at
        FROM contracts
        where borrower_id = $1
        "#,
        id
    )
    .fetch_all(pool)
    .await?;

    let contracts = rows
        .into_iter()
        .map(|row| Contract {
            id: row.id,
            lender_id: row.lender_id,
            borrower_id: row.borrower_id,
            loan_id: row.loan_id,
            initial_ltv: row.initial_ltv,
            initial_collateral_sats: u64::try_from(row.initial_collateral_sats)
                .expect("initial_collateral_sats value should not be negative"),
            loan_amount: row.loan_amount,
            duration_months: row.duration_months,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contracts_by_lender_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<Vec<Contract>> {
    // we can't use query_as! here because postgres does not support u64
    let rows = sqlx::query!(
        r#"
        SELECT 
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            status as "status: crate::model::ContractStatus",
            duration_months,
            created_at,
            updated_at
        FROM contracts
        where lender_id = $1
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    let contracts = rows
        .into_iter()
        .map(|row| Contract {
            id: row.id,
            lender_id: row.lender_id,
            borrower_id: row.borrower_id,
            loan_id: row.loan_id,
            initial_ltv: row.initial_ltv,
            initial_collateral_sats: u64::try_from(row.initial_collateral_sats)
                .expect("initial_collateral_sats value should not be negative"),
            loan_amount: row.loan_amount,
            duration_months: row.duration_months,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn insert_contract_request(
    pool: &Pool<Postgres>,
    borrower_id: String,
    loan_id: String,
    initial_ltv: Decimal,
    initial_collateral_sats: u64,
    loan_amount: Decimal,
    duration_months: i32,
) -> Result<Contract> {
    let id = Uuid::new_v4().to_string();
    let initial_collateral_sats = initial_collateral_sats as i64;

    let lender_id_row = sqlx::query!(
        r#"
        SELECT lender_id
        FROM loan_offers
        WHERE id = $1
        "#,
        loan_id
    )
    .fetch_one(pool)
    .await?;

    let lender_id = lender_id_row.lender_id;

    let row = sqlx::query!(
        r#"
        INSERT INTO contracts (
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            duration_months,
            status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING 
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats as "initial_collateral_sats!: i64",
            loan_amount,
            status as "status: crate::model::ContractStatus",
            duration_months,
            created_at,
            updated_at
        "#,
        id,
        lender_id,
        borrower_id,
        loan_id,
        initial_ltv,
        initial_collateral_sats,
        loan_amount,
        duration_months,
        crate::model::ContractStatus::Requested as crate::model::ContractStatus
    )
    .fetch_one(pool)
    .await?;

    let contract = Contract {
        id: row.id,
        lender_id: row.lender_id,
        borrower_id: row.borrower_id,
        loan_id: row.loan_id,
        initial_ltv: row.initial_ltv,
        initial_collateral_sats: u64::try_from(row.initial_collateral_sats)
            .expect("initial_collateral_sats value should not be negative"),
        loan_amount: row.loan_amount,
        duration_months: row.duration_months,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok(contract)
}

pub async fn update_contract_status(
    pool: &Pool<Postgres>,
    lender_id: &str,
    contract_id: &str,
    new_status: crate::model::ContractStatus,
) -> Result<()> {
    let result = sqlx::query!(
        r#"
        UPDATE contracts
        SET status = $1, 
            updated_at = $2
        WHERE lender_id = $3
          AND id = $4
        "#,
        new_status as crate::model::ContractStatus,
        OffsetDateTime::now_utc(),
        lender_id,
        contract_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        bail!("Contract to update not found")
    }
    Ok(())
}
