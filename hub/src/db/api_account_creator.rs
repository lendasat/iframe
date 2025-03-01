use crate::model::CreatorApiKey;
use anyhow::Result;
use sqlx::Postgres;

/// Authenticate an API account creator by looking for a match for the provided `api_key_hash`.
pub async fn authenticate<'a, E>(tx: E, api_key_hash: &str) -> Result<Option<CreatorApiKey>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let record = sqlx::query_as!(
        CreatorApiKey,
        r#"
            SELECT id, description
            FROM api_account_creator_api_keys
            WHERE api_key_hash = $1
        "#,
        api_key_hash,
    )
    .fetch_optional(tx)
    .await?;

    Ok(record)
}

/// Create a new API account creator.
pub async fn register<'a, E>(tx: E, api_key_hash: &str, description: &str) -> Result<CreatorApiKey>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let created_key = sqlx::query_as!(
        CreatorApiKey,
        r#"
            INSERT INTO api_account_creator_api_keys (api_key_hash, description)
            VALUES ($1, $2)
            RETURNING id, description
        "#,
        api_key_hash,
        description
    )
    .fetch_one(tx)
    .await?;

    Ok(created_key)
}
