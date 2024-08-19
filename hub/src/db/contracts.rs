use crate::model::Contract;
use crate::model::ContractStatus;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn load_all_contracts_by_borrower_id(
    pool: &Pool<Postgres>,
    id: &str,
) -> Result<Vec<Contract>> {
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
            status as "status: ContractStatus",
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
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
        .collect::<Vec<Contract>>();

    Ok(contracts)
}
