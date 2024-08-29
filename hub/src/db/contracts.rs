use crate::model::db;
use crate::model::Contract;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::Address;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn load_contracts_by_borrower_id(
    pool: &Pool<Postgres>,
    id: &str,
) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
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

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contracts_by_lender_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
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

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contract_by_id(pool: &Pool<Postgres>, id: &str) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            duration_months,
            created_at,
            updated_at
        FROM contracts
        where id = $1
        "#,
        id
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn load_contracts_pending_confirmation(pool: &Pool<Postgres>) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            duration_months,
            created_at,
            updated_at
        FROM contracts
        WHERE status IN ($1, $2)
        "#,
        db::ContractStatus::Open as db::ContractStatus,
        db::ContractStatus::CollateralSeen as db::ContractStatus,
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_contract_request(
    pool: &Pool<Postgres>,
    borrower_id: String,
    loan_id: String,
    initial_ltv: Decimal,
    initial_collateral_sats: u64,
    loan_amount: Decimal,
    duration_months: i32,
    borrower_btc_address: Address<NetworkUnchecked>,
    borrower_pk: PublicKey,
    borrower_loan_address: String,
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

    let contract = sqlx::query_as!(
        db::Contract,
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
            status,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
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
        db::ContractStatus::Requested as db::ContractStatus,
        borrower_btc_address.assume_checked().to_string(),
        borrower_pk.to_string(),
        borrower_loan_address,
        None as Option<String>,
        None as Option<i32>,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn accept_contract_request(
    pool: &Pool<Postgres>,
    lender_id: &str,
    contract_id: &str,
    contract_address: Address,
    contract_index: u32,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET status = $1,
            updated_at = $2,
            contract_address = $3,
            contract_index = $4
        WHERE lender_id = $5
          AND id = $6
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            duration_months,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Open as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_address.to_string(),
        contract_index as i32,
        lender_id,
        contract_id
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn mark_contract_as_confirmed(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET status = $1,
            updated_at = $2
        WHERE id = $3
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            duration_months,
            created_at,
            updated_at
        "#,
        db::ContractStatus::CollateralConfirmed as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn reject_contract_request(
    pool: &Pool<Postgres>,
    lender_id: &str,
    contract_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET status = $1,
            updated_at = $2
        WHERE lender_id = $3
          AND id = $4
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            duration_months,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Rejected as db::ContractStatus,
        OffsetDateTime::now_utc(),
        lender_id,
        contract_id
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}
