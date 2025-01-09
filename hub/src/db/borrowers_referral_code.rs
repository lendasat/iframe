use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::PgPool;
use sqlx::Postgres;
use time::OffsetDateTime;

pub struct ReferredBorrower {
    pub id: i32,
    pub referral_code: String,
    pub referred_borrower_id: String,
    pub created_at: OffsetDateTime,
}

pub async fn insert_referred_borrower<'a, E>(
    pool: E,
    referral_code: &str,
    borrower_id: &str,
) -> Result<ReferredBorrower, sqlx::Error>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query_as!(
        ReferredBorrower,
        r#"
        INSERT INTO referred_borrowers (referral_code, referred_borrower_id)
        VALUES ($1, $2)
        RETURNING id, referral_code, referred_borrower_id, created_at
        "#,
        referral_code,
        borrower_id.to_string(),
    )
    .fetch_one(pool)
    .await
}

/// Returns the discount rate only if the user doesn't have a contract yet
pub async fn get_first_time_discount_rate(
    pool: &PgPool,
    borrower_id: &str,
) -> Result<Option<Decimal>, sqlx::Error> {
    // We check if the borrower has any existing contracts
    // A contract only counts if it was actually started, i.e. it was not rejected or timed out
    let has_existing_contracts = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 
            FROM contracts 
            WHERE borrower_id = $1 AND
            status != 'RequestExpired' AND 
            status != 'Rejected'
        )
        "#,
        borrower_id.to_string(),
    )
    .fetch_one(pool)
    .await?;

    // Borrower has already an open contract, no discount rate will be applied
    if has_existing_contracts.unwrap_or(false) {
        return Ok(None);
    }

    // If no existing contracts, get the discount rate from an active referral code
    let discount_rate = sqlx::query_scalar!(
        r#"
        SELECT 
            rcb.first_time_discount_rate_referee
        FROM 
            referred_borrowers rb
        JOIN 
            referral_codes_borrowers rcb ON rb.referral_code = rcb.code
        WHERE 
            rb.referred_borrower_id = $1 AND 
            rcb.active = true AND 
            rcb.expires_at > CURRENT_TIMESTAMP
        "#,
        borrower_id.to_string(),
    )
    .fetch_optional(pool)
    .await?;

    Ok(discount_rate)
}

pub async fn is_referral_code_valid(pool: &PgPool, code: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 
            FROM referral_codes_borrowers 
            WHERE 
                code = $1 AND 
                active = true AND 
                expires_at > CURRENT_TIMESTAMP
        )
        "#,
        code,
    )
    .fetch_one(pool)
    .await
    .map(|exists| exists.unwrap_or(false))
}

pub async fn create_referral_code(
    pool: &PgPool,
    code: &str,
    referrer_id: &str,
    first_time_discount_rate_referee: Decimal,
    first_time_commission_rate_referrer: Decimal,
    commission_rate_referrer: Decimal,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
       INSERT INTO referral_codes_borrowers (
           code,
           referrer_id,
           active,
           first_time_discount_rate_referee,
           first_time_commission_rate_referrer,
           commission_rate_referrer
       )
       VALUES ($1, $2, true, $3, $4, $5)
       "#,
        code,
        referrer_id,
        first_time_discount_rate_referee,
        first_time_commission_rate_referrer,
        commission_rate_referrer,
    )
    .execute(pool)
    .await?;

    Ok(())
}
