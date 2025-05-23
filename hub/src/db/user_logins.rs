use sqlx::Pool;
use sqlx::Postgres;

pub async fn insert_borrower_login_activity(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    ip_address: Option<String>,
    country: Option<String>,
    city: Option<String>,
    user_agent: &str,
) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO borrower_login_activity (borrower_id, ip_address, user_agent, country, city)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        borrower_id,
        ip_address,
        Some(user_agent),
        country,
        city
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_lender_login_activity(
    pool: &Pool<Postgres>,
    lender_id: &str,
    ip_address: Option<String>,
    country: Option<String>,
    city: Option<String>,
    user_agent: &str,
) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO lender_login_activity (lender_id, ip_address, user_agent, country, city)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        lender_id,
        ip_address,
        Some(user_agent),
        country,
        city
    )
    .execute(pool)
    .await?;

    Ok(())
}
