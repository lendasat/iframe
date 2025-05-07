use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn insert_api_key(pool: &Pool<Postgres>, borrower_id: &str, api_key: &str) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO bringin_api_keys (borrower_id, api_key)
        VALUES ($1, $2)
        ON CONFLICT (borrower_id) DO UPDATE SET api_key = $2
        "#,
        borrower_id,
        api_key
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_api_key(pool: &Pool<Postgres>, borrower_id: &str) -> Result<Option<String>> {
    let row = sqlx::query!(
        r#"
        SELECT api_key
        FROM bringin_api_keys
        where borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_optional(pool)
    .await?;

    let api_key = row.map(|r| r.api_key);

    Ok(api_key)
}
