use crate::api_keys::ApiKeyHash;
use crate::model::ApiKeyInfo;
use anyhow::bail;
use anyhow::Result;
use sqlx::Postgres;

/// Authenticate a borrower by looking up the key_id first, then verifying the hash.
///
/// # Returns
///
/// A `borrower_id`, if we find a match for the API key.
pub async fn authenticate_borrower<'a, E>(tx: E, full_api_key: &str) -> Result<Option<String>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    // Parse the API key
    let api_key = match crate::api_keys::ApiKey::from_string(full_api_key) {
        Some(key) => key,
        None => return Ok(None),
    };

    // Look up by key_id
    let record = sqlx::query!(
        r#"
            SELECT borrower_id, api_key_hash, salt
            FROM api_keys_borrower
            WHERE key_id = $1
        "#,
        api_key.key_id(),
    )
    .fetch_optional(tx)
    .await?;

    if let Some(rec) = record {
        // Create ApiKeyHash from database record
        let api_key_hash =
            ApiKeyHash::new(api_key.key_id().to_string(), rec.salt, rec.api_key_hash);

        // Verify the API key
        if api_key_hash.verify(&api_key) {
            return Ok(Some(rec.borrower_id));
        }
    }

    Ok(None)
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

/// Insert an API key for the given borrower.
///
/// We only allow 5 API keys per borrower.
pub async fn insert_borrower<'a, E>(
    tx: E,
    api_key_hash: &ApiKeyHash,
    borrower_id: &str,
    description: &str,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let result = sqlx::query!(
        r#"
            INSERT INTO api_keys_borrower (key_id, api_key_hash, salt, borrower_id, description)
            SELECT $1, $2, $3, $4, $5
            WHERE (
                SELECT COUNT(*)
                FROM api_keys_borrower
                WHERE borrower_id = $4
            ) < 5;
        "#,
        api_key_hash.key_id(),
        api_key_hash.hash(),
        api_key_hash.salt(),
        borrower_id,
        description
    )
    .execute(tx)
    .await;

    match result {
        Ok(query_result) => {
            if query_result.rows_affected() == 0 {
                bail!("Cannot insert another API key. Max = 5")
            }
            Ok(())
        }
        Err(e) => {
            if let Some(db_error) = e.as_database_error() {
                if matches!(db_error.kind(), sqlx::error::ErrorKind::UniqueViolation) {
                    bail!("API key already exists")
                }
            }
            Err(e.into())
        }
    }
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

/// Authenticate a lender by looking up the key_id first, then verifying the hash.
///
/// # Returns
///
/// A `lender_id`, if we find a match for the API key.
pub async fn authenticate_lender<'a, E>(tx: E, full_api_key: &str) -> Result<Option<String>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    // Parse the API key
    let api_key = match crate::api_keys::ApiKey::from_string(full_api_key) {
        Some(key) => key,
        None => return Ok(None),
    };

    // Look up by key_id
    let record = sqlx::query!(
        r#"
            SELECT lender_id, api_key_hash, salt
            FROM api_keys_lender
            WHERE key_id = $1
        "#,
        api_key.key_id(),
    )
    .fetch_optional(tx)
    .await?;

    if let Some(rec) = record {
        // Create ApiKeyHash from database record
        let api_key_hash =
            ApiKeyHash::new(api_key.key_id().to_string(), rec.salt, rec.api_key_hash);

        // Verify the API key
        if api_key_hash.verify(&api_key) {
            return Ok(Some(rec.lender_id));
        }
    }

    Ok(None)
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

/// Insert an API key for the given lender.
///
/// We only allow 5 API keys per lender.
pub async fn insert_lender<'a, E>(
    tx: E,
    api_key_hash: &ApiKeyHash,
    lender_id: &str,
    description: &str,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let result = sqlx::query!(
        r#"
            INSERT INTO api_keys_lender (key_id, api_key_hash, salt, lender_id, description)
            SELECT $1, $2, $3, $4, $5
            WHERE (
                SELECT COUNT(*)
                FROM api_keys_lender
                WHERE lender_id = $4
            ) < 5;
        "#,
        api_key_hash.key_id(),
        api_key_hash.hash(),
        api_key_hash.salt(),
        lender_id,
        description
    )
    .execute(tx)
    .await;

    match result {
        Ok(query_result) => {
            if query_result.rows_affected() == 0 {
                bail!("Cannot insert another API key. Max = 5")
            }
            Ok(())
        }
        Err(e) => {
            if let Some(db_error) = e.as_database_error() {
                if matches!(db_error.kind(), sqlx::error::ErrorKind::UniqueViolation) {
                    bail!("API key already exists")
                }
            }
            Err(e.into())
        }
    }
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
