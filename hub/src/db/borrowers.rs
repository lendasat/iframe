use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::SaltString;
use argon2::Argon2;
use argon2::PasswordHasher;
use rand::distributions::Alphanumeric;
use rand::Rng;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;

const VERIFICATION_CODE_LENGTH: usize = 6;

#[derive(Debug, sqlx::FromRow, Clone)]
pub struct Borrower {
    pub id: String,
    pub name: String,
    pub email: String,
    pub password: String,
    pub verified: bool,
    pub verification_code: Option<String>,
    pub used_referral_code: Option<String>,
    pub password_reset_token: Option<String>,
    pub first_time_discount_rate_referee: Option<Decimal>,
    pub password_reset_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

fn new_model_borrower(
    borrower: Borrower,
    personal_referral_code: Option<String>,
) -> crate::model::Borrower {
    crate::model::Borrower {
        id: borrower.id,
        name: borrower.name,
        email: borrower.email,
        password: borrower.password,
        verified: borrower.verified,
        verification_code: borrower.verification_code,
        used_referral_code: borrower.used_referral_code,
        personal_referral_code,
        first_time_discount_rate_referee: borrower.first_time_discount_rate_referee,
        password_reset_token: borrower.password_reset_token,
        password_reset_at: borrower.password_reset_at,
        created_at: borrower.created_at,
        updated_at: borrower.updated_at,
    }
}

/// Inserts a new user and returns said user
///
/// Fails if user with provided email already exists
pub async fn register_user(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    name: &str,
    email: &str,
    password: &str,
) -> Result<crate::model::Borrower> {
    let id = uuid::Uuid::new_v4().to_string();
    let hashed_password = generate_hashed_password(password)?;
    let verification_code = generate_random_string(VERIFICATION_CODE_LENGTH);

    // First get the user with used referral code info
    // here we don't have to adjust the `first_time_discount_rate_referee` because the user can't
    // have any contracts yet
    let base_user = sqlx::query_as!(
        Borrower,
        r#"
        WITH inserted AS (
            INSERT INTO borrowers (id, name, email, password, verification_code)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        )
        SELECT 
            b.*,
            rb.referral_code as used_referral_code,
            rcb.first_time_discount_rate_referee
        FROM inserted b
        LEFT JOIN referred_borrowers rb ON rb.referred_borrower_id = b.id
        LEFT JOIN referral_codes_borrowers rcb ON rcb.code = rb.referral_code
    "#,
        id,
        name,
        email.to_ascii_lowercase(),
        hashed_password,
        verification_code,
    )
    .fetch_one(&mut **transaction)
    .await?;

    // next we enhance it with a personal code
    let borrower = enhance_with_personal_code(&mut **transaction, base_user).await?;

    Ok(borrower)
}

async fn enhance_with_personal_code<'a, E>(
    pool: E,
    base_user: Borrower,
) -> Result<crate::model::Borrower>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    // Then get their personal referral code if it exists
    let personal_code = sqlx::query!(
        r#"
    SELECT code 
    FROM referral_codes_borrowers 
    WHERE referrer_id = $1
    "#,
        base_user.id
    )
    .fetch_optional(pool)
    .await?;

    // Create the final user struct
    let borrower = new_model_borrower(base_user, personal_code.map(|r| r.code));
    Ok(borrower)
}

pub async fn user_exists(pool: &Pool<Postgres>, email: &str) -> Result<bool> {
    let maybe_user = get_user_by_email(pool, email).await?;

    Ok(maybe_user.is_some())
}

pub async fn get_user_by_email(
    pool: &Pool<Postgres>,
    email: &str,
) -> Result<Option<crate::model::Borrower>> {
    let email = email.to_ascii_lowercase();
    // TODO: try to merge the `enhance` part again
    let maybe_base_user = sqlx::query_as!(
        Borrower,
        r#"SELECT 
           b.*,
           rb.referral_code as "used_referral_code?",
           CASE 
               WHEN EXISTS (
                SELECT 1 FROM contracts c WHERE 
                    c.borrower_id = b.id AND
                    status != 'RequestExpired' AND 
                    status != 'Rejected' 
                ) THEN 0
               ELSE rcb.first_time_discount_rate_referee 
           END as "first_time_discount_rate_referee?"
        FROM borrowers b
            LEFT JOIN referred_borrowers rb ON rb.referred_borrower_id = b.id
            LEFT JOIN referral_codes_borrowers rcb ON rcb.code = rb.referral_code
            WHERE b.email = $1
        "#,
        email
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    if let Some(base_user) = maybe_base_user {
        Ok(Some(enhance_with_personal_code(pool, base_user).await?))
    } else {
        Ok(None)
    }
}
pub async fn get_user_by_id(
    pool: &Pool<Postgres>,
    id: &str,
) -> Result<Option<crate::model::Borrower>> {
    let maybe_base_user = sqlx::query_as!(
        Borrower,
        r#"
           SELECT 
               b.*,
                rb.referral_code as "used_referral_code?",
                CASE 
                   WHEN EXISTS (
                    SELECT 1 FROM contracts c WHERE 
                        c.borrower_id = b.id AND
                        status != 'RequestExpired' AND 
                        status != 'Rejected' 
                    ) THEN 0
                ELSE rcb.first_time_discount_rate_referee 
           END as "first_time_discount_rate_referee?"
           FROM borrowers b
           LEFT JOIN referred_borrowers rb ON rb.referred_borrower_id = b.id
           LEFT JOIN referral_codes_borrowers rcb ON rcb.code = rb.referral_code
           WHERE b.id = $1
       "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    if let Some(base_user) = maybe_base_user {
        Ok(Some(enhance_with_personal_code(pool, base_user).await?))
    } else {
        Ok(None)
    }
}
pub async fn get_user_by_verification_code(
    pool: &Pool<Postgres>,
    verification_code: &str,
) -> Result<Option<crate::model::Borrower>> {
    let verification_code = verification_code.to_ascii_lowercase();
    let maybe_base_user = sqlx::query_as!(
        Borrower,
        r#"SELECT
               b.id,
               b.name,
               b.email,
               b.password,
               b.verified,
               b.verification_code,
               b.password_reset_token,
               b.password_reset_at,
               b.created_at,
               b.updated_at,
               rb.referral_code as "used_referral_code?",
               CASE 
                   WHEN EXISTS (
                    SELECT 1 FROM contracts c WHERE 
                        c.borrower_id = b.id AND
                        status != 'RequestExpired' AND 
                        status != 'Rejected' 
                    ) THEN 0
                 ELSE rcb.first_time_discount_rate_referee 
                END as "first_time_discount_rate_referee?"
           FROM borrowers b
           LEFT JOIN referred_borrowers rb ON rb.referred_borrower_id = b.id
           LEFT JOIN referral_codes_borrowers rcb ON rcb.code = rb.referral_code
           WHERE b.verification_code = $1"#,
        verification_code
    )
    .fetch_optional(pool)
    .await?;

    if let Some(base_user) = maybe_base_user {
        Ok(Some(enhance_with_personal_code(pool, base_user).await?))
    } else {
        Ok(None)
    }
}
pub async fn verify_user(pool: &Pool<Postgres>, verification_code: &str) -> Result<()> {
    let verification_code = verification_code.to_ascii_lowercase();
    sqlx::query!(
        "UPDATE borrowers SET verification_code = $1, verified = $2 WHERE verification_code = $3",
        Option::<String>::None,
        true,
        verification_code,
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_password_reset_token_for_user(
    pool: &Pool<Postgres>,
    password_reset_token: &str,
    password_reset_token_expiry: OffsetDateTime,
    email: &str,
) -> Result<()> {
    sqlx::query!(
        "UPDATE borrowers
        SET password_reset_token = $1,
            password_reset_at    = $2
        WHERE email = $3",
        password_reset_token,
        password_reset_token_expiry,
        email,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Returns a user by reset token.
///
/// Returns None if the reset token as already been expired
pub async fn get_user_by_rest_token(
    pool: &Pool<Postgres>,
    password_reset_token: &str,
) -> Result<Option<crate::model::Borrower>> {
    let maybe_base_user = sqlx::query_as!(
        Borrower,
        r#"SELECT
           b.*,
           rb.referral_code as "used_referral_code?",
           CASE 
               WHEN EXISTS (
                SELECT 1 FROM contracts c WHERE 
                    c.borrower_id = b.id AND
                    status != 'RequestExpired' AND 
                    status != 'Rejected' 
                ) THEN 0
               ELSE rcb.first_time_discount_rate_referee 
           END as "first_time_discount_rate_referee?"
       FROM borrowers b
           LEFT JOIN referred_borrowers rb ON rb.referred_borrower_id = b.id
           LEFT JOIN referral_codes_borrowers rcb ON rcb.code = rb.referral_code
           WHERE b.password_reset_token = $1
           AND b.password_reset_at > $2"#,
        password_reset_token,
        OffsetDateTime::now_utc(),
    )
    .fetch_optional(pool)
    .await?;

    if let Some(base_user) = maybe_base_user {
        Ok(Some(enhance_with_personal_code(pool, base_user).await?))
    } else {
        Ok(None)
    }
}

pub async fn update_user_password(
    pool: &Pool<Postgres>,
    password: &str,
    email: &str,
) -> Result<()> {
    let hashed_password = generate_hashed_password(password)?;
    sqlx::query!(
        "UPDATE borrowers
                SET password             = $1,
                    password_reset_token = $2,
                    password_reset_at    = $3
                WHERE email = $4
        ",
        hashed_password,
        Option::<String>::None,
        Option::<OffsetDateTime>::None,
        email.to_ascii_lowercase(),
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub fn generate_hashed_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let hashed_password = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| anyhow!("Failed hashing password {error}"))?;
    Ok(hashed_password)
}

/// Generates a random alphanumeric string with length [`length`]
pub fn generate_random_string(length: usize) -> String {
    let rng = rand::thread_rng();

    let random_string: String = rng
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(|c| char::from(c).to_ascii_lowercase())
        .collect();

    random_string
}
