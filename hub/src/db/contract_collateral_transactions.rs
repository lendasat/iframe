use anyhow::Result;
use bitcoin::Txid;
use serde::Deserialize;
use serde::Serialize;
use sqlx::PgPool;
use time::OffsetDateTime;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ContractCollateralTransaction {
    pub id: i32,
    pub tx_id: String,
    /// The amount in sats, note this is actually an unsigned int. It's only signed because of the
    /// db
    pub amount_spent: i64,
    /// The amount in sats, note this is actually an unsigned int. It's only signed because of the
    /// db
    pub amount_deposited: i64,
    pub block_time: Option<OffsetDateTime>,
    pub block_height: Option<i64>,
    pub contract_id: String,
    pub created_at: OffsetDateTime,
}

pub struct ContractTransactionInsert {
    pub tx_id: Txid,
    /// The amount in sats, note this is actually an unsigned int. It's only signed because of the
    /// db
    pub amount_spent: i64,
    /// The amount in sats, note this is actually an unsigned int. It's only signed because of the
    /// db
    pub amount_deposited: i64,
    pub block_time: Option<OffsetDateTime>,
    pub block_height: Option<u32>,
    pub contract_id: String,
}

pub async fn insert_funding(
    db_pool: &PgPool,
    contract_id: &str,
    tx_id: &Txid,
    amount: i64,
    block_time: Option<OffsetDateTime>,
    block_height: Option<u32>,
) -> Result<ContractCollateralTransaction> {
    insert_internal(
        db_pool,
        ContractTransactionInsert {
            tx_id: *tx_id,
            amount_deposited: amount,
            amount_spent: 0,
            block_time,
            block_height,
            contract_id: contract_id.to_string(),
        },
    )
    .await
}

pub async fn insert_claim_collateral(
    db_pool: &PgPool,
    contract_id: &str,
    tx_id: &Txid,
    amount: i64,
    block_time: Option<OffsetDateTime>,
    block_height: Option<u32>,
) -> Result<ContractCollateralTransaction> {
    insert_internal(
        db_pool,
        ContractTransactionInsert {
            tx_id: *tx_id,
            amount_deposited: 0,
            amount_spent: amount,
            block_time,
            block_height,
            contract_id: contract_id.to_string(),
        },
    )
    .await
}

pub async fn bulk_insert(
    db_pool: &PgPool,
    transactions: Vec<ContractTransactionInsert>,
) -> Result<Vec<ContractCollateralTransaction>> {
    if transactions.is_empty() {
        return Ok(vec![]);
    }

    let mut tx_ids = Vec::with_capacity(transactions.len());
    let mut amount_deposited = Vec::with_capacity(transactions.len());
    let mut amount_spent = Vec::with_capacity(transactions.len());
    let mut block_times: Vec<Option<OffsetDateTime>> = Vec::with_capacity(transactions.len());
    let mut block_heights: Vec<Option<i64>> = Vec::with_capacity(transactions.len());
    let mut contract_ids = Vec::with_capacity(transactions.len());

    for tx in transactions {
        tx_ids.push(tx.tx_id.to_string());
        amount_deposited.push(tx.amount_deposited);
        amount_spent.push(tx.amount_spent);
        block_times.push(tx.block_time);
        block_heights.push(tx.block_height.map(|t| t as i64));
        contract_ids.push(tx.contract_id);
    }

    let inserted = sqlx::query_as!(
        ContractCollateralTransaction,
        r#"
            INSERT INTO contract_collateral_transactions (
                tx_id, 
                amount_deposited,
                amount_spent,
                block_time,
                block_height,
                contract_id
            )
            SELECT * FROM UNNEST(
                $1::text[], 
                $2::bigint[],
                $3::bigint[],
                $4::timestamptz[],
                $5::bigint[],
                $6::text[]
            )
            ON CONFLICT (tx_id, contract_id)
            DO UPDATE SET
                block_time = CASE
                    WHEN EXCLUDED.block_time IS NOT NULL THEN EXCLUDED.block_time
                    ELSE contract_collateral_transactions.block_time
                END,
                block_height = CASE
                    WHEN EXCLUDED.block_height IS NOT NULL THEN EXCLUDED.block_height
                    ELSE contract_collateral_transactions.block_height
                END
            RETURNING
                id,
                tx_id,
                amount_spent,
                amount_deposited,
                block_time as "block_time: OffsetDateTime",
                block_height,
                contract_id,
                created_at as "created_at: OffsetDateTime"
        "#,
        &tx_ids[..],
        &amount_deposited[..],
        &amount_spent[..],
        &block_times[..] as &[Option<OffsetDateTime>],
        &block_heights[..] as &[Option<i64>],
        &contract_ids[..]
    )
    .fetch_all(db_pool)
    .await?;

    Ok(inserted)
}

async fn insert_internal(
    db_pool: &PgPool,
    transaction: ContractTransactionInsert,
) -> Result<ContractCollateralTransaction> {
    let inserted = sqlx::query_as!(
        ContractCollateralTransaction,
        r#"
            INSERT INTO contract_collateral_transactions (
                tx_id, 
                amount_deposited,
                amount_spent,
                block_time,
                block_height,
                contract_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                tx_id,
                amount_deposited,
                amount_spent,
                block_time as "block_time: OffsetDateTime",
                block_height,
                contract_id,
                created_at as "created_at: OffsetDateTime"
        "#,
        transaction.tx_id.to_string(),
        transaction.amount_deposited,
        transaction.amount_spent,
        transaction.block_time,
        transaction.block_height.map(|b| b as i64),
        transaction.contract_id
    )
    .fetch_one(db_pool)
    .await?;

    Ok(inserted)
}

pub async fn get_by_contract_id(
    db_pool: &PgPool,
    contract_id: &str,
) -> Result<Vec<ContractCollateralTransaction>> {
    let transactions = sqlx::query_as!(
        ContractCollateralTransaction,
        r#"
            SELECT
                id,
                tx_id,
                amount_deposited,
                amount_spent,
                block_time as "block_time: OffsetDateTime",
                block_height,
                contract_id,
                created_at as "created_at: OffsetDateTime"
            FROM contract_collateral_transactions
            WHERE contract_id = $1
            ORDER BY created_at DESC
        "#,
        contract_id
    )
    .fetch_all(db_pool)
    .await?;

    Ok(transactions)
}

pub async fn delete_by_id_and_contract_id(db_pool: &PgPool, id: i32) -> Result<bool> {
    let result = sqlx::query!(
        r#"
            DELETE FROM contract_collateral_transactions
            WHERE id = $1 
        "#,
        id
    )
    .execute(db_pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
