use sqlx::Pool;
use sqlx::Postgres;

pub async fn insert_borrower_login_activity(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    ip_address: Option<String>,
    user_agent: &str,
) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO borrower_login_activity (borrower_id, ip_address, user_agent)
        VALUES ($1, $2, $3)
        "#,
        borrower_id,
        ip_address,
        Some(user_agent)
    )
    .execute(pool)
    .await?;

    Ok(())
}
