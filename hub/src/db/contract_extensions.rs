use sqlx::query;
use sqlx::query_scalar;
use sqlx::Error;
use sqlx::Pool;
use sqlx::Postgres;
use sqlx::Transaction;

pub async fn insert_contract_extension(
    tx: &mut Transaction<'_, Postgres>,
    parent_contract_id: &str,
    extended_contract_id: &str,
) -> Result<(), Error> {
    if parent_contract_id == extended_contract_id {
        return Err(Error::Protocol("Contract cannot extend itself".into()));
    }

    // Check if parent contracts exist
    let parent_exists = query!(
        "SELECT EXISTS(SELECT 1 FROM contracts WHERE id = $1) as exists",
        parent_contract_id
    )
    .fetch_one(&mut **tx)
    .await?
    .exists
    .unwrap_or(false);

    let extended_exists = query!(
        "SELECT EXISTS(SELECT 1 FROM contracts WHERE id = $1) as exists",
        extended_contract_id
    )
    .fetch_one(&mut **tx)
    .await?
    .exists
    .unwrap_or(false);

    if !parent_exists || !extended_exists {
        return Err(Error::Protocol("One or both contracts do not exist".into()));
    }

    // Insert the extension relationship
    query!(
        r#"
        INSERT INTO contract_extensions (
            parent_contract_id,
            extended_contract_id,
            created_at
        ) VALUES ($1, $2, CURRENT_TIMESTAMP)
        "#,
        parent_contract_id,
        extended_contract_id
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

pub async fn get_parent_by_extended(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Option<String>, Error> {
    query_scalar!(
        r#"
        SELECT parent_contract_id
        FROM contract_extensions
        WHERE extended_contract_id = $1
        "#,
        contract_id
    )
    .fetch_optional(pool)
    .await
}

pub async fn get_extended_by_parent(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Option<String>, Error> {
    query_scalar!(
        r#"
        SELECT extended_contract_id
            FROM contract_extensions
        WHERE parent_contract_id = $1
        "#,
        contract_id
    )
    .fetch_optional(pool)
    .await
}

pub async fn delete_with_parent<'a, E>(pool: E, parent_id: &str) -> Result<(), Error>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let rows_affected = sqlx::query!(
        r#"
    DELETE FROM contract_extensions
    WHERE parent_contract_id = $1
    "#,
        parent_id
    )
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(Error::Protocol("Parent contract does not exist".into()));
    }
    Ok(())
}
