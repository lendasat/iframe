use crate::model::ContractStatus;
use anyhow::Result;
use sqlx::postgres::PgPool;
use sqlx::Postgres;
use time::OffsetDateTime;

// Struct to hold the query results
#[derive(Debug)]
pub struct ContractStatusLogDb {
    pub id: i32,
    pub contract_id: String,
    pub old_status: crate::model::db::ContractStatus,
    pub new_status: crate::model::db::ContractStatus,
    pub changed_at: OffsetDateTime,
}

#[derive(Debug)]
pub struct ContractStatusLog {
    pub contract_id: String,
    pub old_status: ContractStatus,
    pub new_status: ContractStatus,
    pub changed_at: OffsetDateTime,
}

impl From<ContractStatusLogDb> for ContractStatusLog {
    fn from(value: ContractStatusLogDb) -> Self {
        ContractStatusLog {
            contract_id: value.contract_id,
            old_status: value.old_status.into(),
            new_status: value.new_status.into(),
            changed_at: value.changed_at,
        }
    }
}

/// Fetch the [`ContractStatus`] history for a given contract, from newest to oldest.
pub async fn get_contract_status_logs(
    pool: &PgPool,
    contract_id: &str,
) -> Result<Vec<ContractStatusLog>, sqlx::Error> {
    let logs = sqlx::query_as!(
        ContractStatusLogDb,
        r#"
        SELECT 
            id,
            contract_id,
            old_status as "old_status: crate::model::db::ContractStatus",
            new_status as "new_status: crate::model::db::ContractStatus",
            changed_at
        FROM 
            contracts_status_log
        WHERE 
            contract_id = $1
        ORDER BY 
            changed_at DESC
        "#,
        contract_id
    )
    .fetch_all(pool)
    .await?;

    Ok(logs.into_iter().map(ContractStatusLog::from).collect())
}

/// Duplicate all contract status log entries from a parent contract to a new contract.
/// This is used during contract extensions to preserve the status history.
pub async fn duplicate<'a, E>(tx: E, parent_contract_id: &str, new_contract_id: &str) -> Result<i64>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    // Insert duplicates with the new contract_id
    let result = sqlx::query!(
        r#"
        INSERT INTO contracts_status_log (contract_id, old_status, new_status, changed_at)
        SELECT
            $1 as contract_id,
            old_status,
            new_status,
            changed_at
        FROM contracts_status_log
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
