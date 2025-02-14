use crate::model::ApiKeyInfo;
use anyhow::bail;
use anyhow::Result;
use sqlx::Postgres;

/// Authenticate a borrower by looking for a match for the provided `api_key_hash`.
///
/// # Returns
///
/// A `borrower_id`, if we find a match for the `api_key_hash` in the `api_keys_borrower` table.
pub async fn authenticate_borrower<'a, E>(tx: E, api_key_hash: &str) -> Result<Option<String>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let borrower_id = sqlx::query_scalar!(
        r#"
            SELECT borrower_id
            FROM api_keys_borrower
            WHERE api_key_hash = $1
        "#,
        api_key_hash,
    )
    .fetch_optional(tx)
    .await?;

    Ok(borrower_id)
}

/// Get the public information about the API keys belonging to the given borrower.
pub async fn get_api_keys_borrower<'a, E>(tx: E, borrower_id: &str) -> Result<Vec<ApiKeyInfo>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let api_keys = sqlx::query_as!(
        ApiKeyInfo,
        r#"
            SELECT id, description, created_at
            FROM api_keys_borrower
            WHERE borrower_id = $1
        "#,
        borrower_id,
    )
    .fetch_all(tx)
    .await?;

    Ok(api_keys)
}

/// Insert an API key hash for the given borrower.
///
/// We only allow 5 API keys per borrower.
pub async fn insert_borrower<'a, E>(
    tx: E,
    api_key_hash: &str,
    borrower_id: &str,
    description: &str,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let rows_affected = sqlx::query!(
        r#"
            INSERT INTO api_keys_borrower (api_key_hash, borrower_id, description)
            SELECT $1, $2, $3
            WHERE (
                SELECT COUNT(*)
                FROM api_keys_borrower
                WHERE borrower_id = $2
            ) < 5;
        "#,
        api_key_hash,
        borrower_id,
        description
    )
    .execute(tx)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        bail!("Cannot insert another API key. Max = 5")
    }

    Ok(())
}

/// Delete the API key idenfified by `id`, as long as it belongs to the given borrower.
pub async fn delete_borrower<'a, E>(tx: E, borrower_id: &str, id: i32) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        r#"
            DELETE FROM api_keys_borrower
            WHERE borrower_id = $1 AND id = $2
        "#,
        borrower_id,
        id
    )
    .execute(tx)
    .await?;

    Ok(())
}

/// Authenticate a lender by looking for a match for the provided `api_key_hash`.
///
/// # Returns
///
/// A `lender_id`, if we find a match for the `api_key_hash` in the `api_keys_lender` table.
pub async fn authenticate_lender<'a, E>(tx: E, api_key_hash: &str) -> Result<Option<String>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let lender_id = sqlx::query_scalar!(
        r#"
            SELECT lender_id
            FROM api_keys_lender
            WHERE api_key_hash = $1
        "#,
        api_key_hash,
    )
    .fetch_optional(tx)
    .await?;

    Ok(lender_id)
}

/// Get the public information about the API keys belonging to the given lender.
pub async fn get_api_keys_lender<'a, E>(tx: E, lender_id: &str) -> Result<Vec<ApiKeyInfo>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let api_keys = sqlx::query_as!(
        ApiKeyInfo,
        r#"
            SELECT id, description, created_at
            FROM api_keys_lender
            WHERE lender_id = $1
        "#,
        lender_id,
    )
    .fetch_all(tx)
    .await?;

    Ok(api_keys)
}

/// Insert an API key hash for the given lender.
///
/// We only allow 5 API keys per lender.
pub async fn insert_lender<'a, E>(
    tx: E,
    api_key_hash: &str,
    lender_id: &str,
    description: &str,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let rows_affected = sqlx::query!(
        r#"
            INSERT INTO api_keys_lender (api_key_hash, lender_id, description)
            SELECT $1, $2, $3
            WHERE (
                SELECT COUNT(*)
                FROM api_keys_lender
                WHERE lender_id = $2
            ) < 5;
        "#,
        api_key_hash,
        lender_id,
        description
    )
    .execute(tx)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        bail!("Cannot insert another API key. Max = 5")
    }

    Ok(())
}

/// Delete the API key idenfified by `id`, as long as it belongs to the given lender.
pub async fn delete_lender<'a, E>(tx: E, lender_id: &str, id: i32) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        r#"
            DELETE FROM api_keys_lender
            WHERE lender_id = $1 AND id = $2
        "#,
        lender_id,
        id
    )
    .execute(tx)
    .await?;

    Ok(())
}
