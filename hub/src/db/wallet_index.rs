use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

// Insert a new row
pub async fn get_max_and_increment(pool: &Pool<Postgres>) -> Result<i32> {
    let result = sqlx::query_scalar!(
        r#"
        WITH max_id AS (
            SELECT COALESCE(MAX(id), 0) + 1 AS next_id
            FROM hub_wallet_index
        )
        INSERT INTO hub_wallet_index (id)
        SELECT next_id FROM max_id
        RETURNING id;
        "#
    )
    .fetch_one(pool)
    .await?;

    Ok(result)
}
