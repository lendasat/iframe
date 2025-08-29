use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

/// Check if a borrower is currently jailed
pub async fn is_borrower_jailed(pool: &Pool<Postgres>, borrower_id: &str) -> Result<bool> {
    let result = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM borrower_jail WHERE borrower_id = $1)",
        borrower_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result.unwrap_or(false))
}

/// Check if a lender is currently jailed
pub async fn is_lender_jailed(pool: &Pool<Postgres>, lender_id: &str) -> Result<bool> {
    let result = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM lender_jail WHERE lender_id = $1)",
        lender_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result.unwrap_or(false))
}
