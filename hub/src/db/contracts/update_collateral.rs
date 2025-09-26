use crate::db::contracts::load_contract;
use crate::model::db;
use crate::model::Contract;
use crate::model::ContractStatus;
use anyhow::bail;
use sqlx::Pool;
use sqlx::Postgres;
use std::cmp::Ordering;
use time::OffsetDateTime;

pub async fn update_status_and_collateral(
    pool: &Pool<Postgres>,
    contract_id: &str,
    updated_collateral_sats: u64,
    new_status: ContractStatus,
) -> anyhow::Result<Contract> {
    let new_status = db::ContractStatus::from(new_status);

    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            collateral_sats = $1,
            status = $2,
            updated_at = $3
        WHERE id = $4
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        "#,
        updated_collateral_sats as i64,
        new_status as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn update_collateral_sats(
    pool: &Pool<Postgres>,
    contract_id: &str,
    updated_collateral_sats: u64,
) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        UPDATE contracts
        SET
            collateral_sats = $1,
            updated_at = $2
        WHERE id = $3
        "#,
        updated_collateral_sats as i64,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}
