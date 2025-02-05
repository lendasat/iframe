use anyhow::Result;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::PgPool;
use sqlx::Postgres;
use time::Duration;
use time::OffsetDateTime;

/// The discount a referred user will receive on their first loan
const FIRST_TIME_DISCOUNT_RATE_REFEREE: Decimal = dec!(0.3);

/// The commission a referrer receives
const FIRST_TIME_COMMISSION_RATE_REFERRER: Decimal = dec!(0.3);

// The commission a referrer would receive for successive loans
const COMMISSION_RATE_REFERRER: Decimal = Decimal::ZERO;
const DEFAULT_REFERRAL_EXPIRY_DAYS: i64 = 360;

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
            rcb.FIRST_TIME_DISCOUNT_RATE_REFEREE
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

fn generate_referral_code() -> String {
    use rand::thread_rng;
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let mut rng = thread_rng();
    let random_part: String = (0..5)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();

    format!("LAS-{}", random_part)
}

async fn generate_unique_referral_code(pool: &PgPool) -> Result<String> {
    for _ in 0..10 {
        let code = generate_referral_code();

        let exists = sqlx::query!(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM referral_codes_borrowers WHERE code = $1
            ) as "exists!"
            "#,
            code
        )
        .fetch_one(pool)
        .await?
        .exists;

        if !exists {
            return Ok(code);
        }
    }

    Err(anyhow::anyhow!(
        "Failed to generate unique referral code after 10 attempts"
    ))
}

pub async fn create_referral_code(
    pool: &PgPool,
    code: Option<String>,
    referrer_id: &str,
) -> Result<()> {
    let code = match code {
        Some(code) => code,
        None => generate_unique_referral_code(pool).await?,
    };

    let first_time_discount_rate_referee = FIRST_TIME_DISCOUNT_RATE_REFEREE;
    let first_time_commission_rate_referrer = FIRST_TIME_COMMISSION_RATE_REFERRER;
    let commission_rate_referrer = COMMISSION_RATE_REFERRER;
    let created_at = OffsetDateTime::now_utc();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(DEFAULT_REFERRAL_EXPIRY_DAYS);
    let active = true;

    sqlx::query!(
        r#"
        INSERT INTO referral_codes_borrowers (
            code,
            referrer_id,
            active,
            first_time_discount_rate_referee,
            first_time_commission_rate_referrer,
            commission_rate_referrer,
            created_at,
            expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        code,
        referrer_id,
        active,
        first_time_discount_rate_referee,
        first_time_commission_rate_referrer,
        commission_rate_referrer,
        created_at,
        expires_at,
    )
    .execute(pool)
    .await?;

    Ok(())
}
