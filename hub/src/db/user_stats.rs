use sqlx::Pool;
use sqlx::Postgres;
use sqlx::Result;
use time::OffsetDateTime;

#[derive(Debug)]
pub struct LenderStats {
    pub id: String,
    pub name: String,
    pub timezone: Option<String>,
    pub successful_contracts: i64,
    pub failed_contracts: i64,
    pub created_at: OffsetDateTime,
}

pub async fn get_lender_stats(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<LenderStats, sqlx::Error> {
    let stats = sqlx::query_as!(
        LenderStats,
        r#"
        SELECT 
            l.id, 
            l.name,
            l.timezone,
            l.created_at,
            COUNT(
                CASE WHEN 
                    c.status = 'Closed' 
                    THEN 1 END
                ) as "successful_contracts!",
            COUNT(
                CASE WHEN 
                    c.status = 'Rejected' or 
                    c.status = 'RequestExpired'
                    THEN 1 END
                ) as "failed_contracts!"
        FROM lenders l
        LEFT JOIN contracts c ON c.lender_id = l.id
        WHERE l.id = $1
        GROUP BY l.name, l.id
        "#,
        lender_id
    )
    .fetch_one(pool)
    .await?;

    Ok(stats)
}

#[derive(Debug)]
pub struct BorrowerStats {
    pub id: String,
    pub name: String,
    pub timezone: Option<String>,
    pub successful_contracts: i64,
    pub failed_contracts: i64,
    pub created_at: OffsetDateTime,
}

pub async fn get_borrower_stats(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<BorrowerStats, sqlx::Error> {
    let stats = sqlx::query_as!(
        BorrowerStats,
        r#"
        SELECT 
            b.id, 
            b.name,
            b.timezone,
            b.created_at,
            COUNT(
                CASE WHEN 
                    c.status = 'Closed'
                    THEN 1 END
                ) as "successful_contracts!",
            COUNT(
                CASE WHEN 
                    c.status = 'Cancelled'
                    THEN 1 END
                ) as "failed_contracts!"
        FROM borrowers b
        LEFT JOIN contracts c ON c.borrower_id = b.id
        WHERE b.id = $1
        GROUP BY b.name, b.id
        "#,
        borrower_id
    )
    .fetch_one(pool)
    .await?;

    Ok(stats)
}
