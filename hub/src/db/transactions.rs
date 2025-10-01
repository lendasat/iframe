use crate::model::LoanTransaction;
use crate::model::TransactionType;
use anyhow::Result;
use sqlx::PgPool;
use sqlx::Postgres;

pub async fn insert_principal_given_txid(
    db_pool: &PgPool,
    contract_id: &str,
    principal_given: &str,
) -> Result<LoanTransaction> {
    let loan_tx = insert(
        db_pool,
        contract_id,
        principal_given,
        TransactionType::PrincipalGiven,
    )
    .await?;
    Ok(loan_tx)
}

// It's not always a transaction ID in the blockchain sense, but alas.
pub async fn insert_installment_paid_txid(
    db_pool: &PgPool,
    contract_id: &str,
    installment_paid: &str,
) -> Result<LoanTransaction> {
    let loan_tx = insert(
        db_pool,
        contract_id,
        installment_paid,
        TransactionType::InstallmentPaid,
    )
    .await?;
    Ok(loan_tx)
}

async fn insert(
    db_pool: &PgPool,
    contract_id: &str,
    tx_id: &str,
    transaction_type: TransactionType,
) -> Result<LoanTransaction> {
    let mut sql_tx = db_pool.begin().await?;

    if let Some(existing_transaction) =
        find_transaction_by_id(&mut sql_tx, tx_id, contract_id).await?
    {
        sql_tx.commit().await?;
        return Ok(existing_transaction);
    }

    let new_transaction = inner_insert(&mut sql_tx, contract_id, tx_id, transaction_type).await?;

    sql_tx.commit().await?;

    Ok(new_transaction)
}

async fn inner_insert(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    contract_id: &str,
    tx_id: &str,
    transaction_type: TransactionType,
) -> Result<LoanTransaction> {
    let tx = sqlx::query_as!(
        LoanTransaction,
        r#"
            INSERT INTO transactions (txid, contract_id, transaction_type)
            VALUES ($1, $2, $3)
            RETURNING
                id,
                txid,
                contract_id,
                transaction_type as "transaction_type: crate::model::TransactionType",
                timestamp
        "#,
        tx_id,
        contract_id,
        transaction_type as TransactionType
    )
    .fetch_one(&mut **transaction)
    .await?;

    Ok(tx)
}

async fn find_transaction_by_id(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    tx_id: &str,
    contract_id: &str,
) -> Result<Option<LoanTransaction>> {
    let tx = sqlx::query_as!(
        LoanTransaction,
        r#"
            SELECT
                id,
                txid,
                contract_id,
                transaction_type as "transaction_type: crate::model::TransactionType",
                timestamp
            FROM transactions
            WHERE txid = $1 AND contract_id = $2
        "#,
        tx_id,
        contract_id
    )
    .fetch_optional(&mut **transaction)
    .await?;

    Ok(tx)
}

pub async fn get_all_for_contract_id(
    db_pool: &PgPool,
    contract_id: &str,
) -> Result<Vec<LoanTransaction>> {
    let records = sqlx::query_as!(
        LoanTransaction,
        r#"
            SELECT
                id,
                txid,
                contract_id,
                transaction_type as "transaction_type: crate::model::TransactionType",
                timestamp
            FROM transactions
            WHERE contract_id = $1
        "#,
        contract_id
    )
    .fetch_all(db_pool)
    .await?;

    Ok(records)
}

pub async fn duplicate_transactions<'a, E>(
    tx: E,
    parent_contract_id: &str,
    new_contract_id: &str,
) -> Result<i64>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    // Insert duplicates with the new contract_id
    let result = sqlx::query!(
        r#"
        INSERT INTO transactions (txid, transaction_type, timestamp, contract_id)
        SELECT
            txid,
            transaction_type,
            timestamp,
            $1 as contract_id
        FROM transactions
        WHERE contract_id = $2
        RETURNING id
        "#,
        new_contract_id,
        parent_contract_id
    )
    .fetch_all(tx)
    .await?;

    Ok(result.len() as i64)
}
