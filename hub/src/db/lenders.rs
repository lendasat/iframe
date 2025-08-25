use crate::model::InviteCode;
use crate::model::Lender;
use anyhow::Result;
use rand::distributions::Alphanumeric;
use rand::Rng;
use sqlx::PgPool;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;

const VERIFICATION_CODE_LENGTH: usize = 6;

/// Inserts a new user and returns said user
///
/// Fails if user with provided email already exists
pub async fn register_user<'a, E>(
    pool: E,
    name: &str,
    email: &str,
    salt: &str,
    verifier: &str,
    invite_code: Option<InviteCode>,
) -> Result<Lender>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let email = email.to_ascii_lowercase();
    let email = email.trim();

    let verification_code = generate_random_string(VERIFICATION_CODE_LENGTH);
    let invite_code = invite_code.map(|code| code.id);

    let id = uuid::Uuid::new_v4().to_string();
    let user: Lender = sqlx::query_as!(
        Lender,
        "INSERT INTO lenders (id, name, email, salt, verifier, verification_code, invite_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *",
        id,
        name,
        email,
        salt,
        verifier,
        verification_code,
        invite_code,
    )
    .fetch_one(pool)
    .await?;
    Ok(user)
}

/// Replace `salt` and `verifier` needed to authenticate a lender via PAKE. This is used when the
/// lender wants to change their password.
pub async fn update_verifier_and_salt<'a, E>(
    pool: E,
    email: &str,
    salt: &str,
    verifier: &str,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        "UPDATE lenders
        SET salt = $1,
            verifier = $2
        WHERE email = $3",
        salt,
        verifier,
        email
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn user_exists(pool: &Pool<Postgres>, email: &str) -> Result<bool> {
    let maybe_user = get_user_by_email(pool, email).await?;

    Ok(maybe_user.is_some())
}

pub async fn get_user_by_email(pool: &Pool<Postgres>, email: &str) -> Result<Option<Lender>> {
    let email = email.to_ascii_lowercase();
    let maybe_user = sqlx::query_as!(Lender, "SELECT * FROM lenders WHERE email = $1", email)
        .fetch_optional(pool)
        .await?;
    Ok(maybe_user)
}
pub async fn get_user_by_id(pool: &Pool<Postgres>, id: &str) -> Result<Option<Lender>> {
    let maybe_user = sqlx::query_as!(Lender, "SELECT * FROM lenders WHERE id = $1", id)
        .fetch_optional(pool)
        .await?;
    Ok(maybe_user)
}

pub async fn get_user_by_verification_code(
    pool: &Pool<Postgres>,
    verification_code: &str,
) -> Result<Option<Lender>> {
    let verification_code = verification_code.to_ascii_lowercase();
    let maybe_user = sqlx::query_as!(
        Lender,
        "SELECT * FROM lenders WHERE verification_code = $1",
        verification_code
    )
    .fetch_optional(pool)
    .await?;
    Ok(maybe_user)
}

pub async fn verify_user(pool: &Pool<Postgres>, verification_code: &str) -> Result<()> {
    let verification_code = verification_code.to_ascii_lowercase();
    sqlx::query!(
        "UPDATE lenders SET verification_code = $1, verified = $2 WHERE verification_code = $3",
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
        "UPDATE lenders SET
            password_reset_token = $1,
            password_reset_at = $2
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
) -> Result<Option<Lender>> {
    let maybe_user = sqlx::query_as!(
        Lender,
        "SELECT
            id,
            name,
            email,
            salt,
            verifier,
            password,
            verified,
            vetted,
            verification_code,
            invite_code,
            password_reset_token,
            timezone,
            locale,
            totp_secret,
            totp_enabled,
            password_reset_at,
            created_at,
            updated_at
        FROM lenders
            WHERE password_reset_token = $1
          AND password_reset_at > $2",
        password_reset_token,
        OffsetDateTime::now_utc(),
    )
    .fetch_optional(pool)
    .await?;
    Ok(maybe_user)
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

pub async fn update_lender_timezone(pool: &PgPool, lender_id: &str, timezone: &str) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE lenders
        SET
            timezone = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        "#,
        timezone,
        lender_id.to_string(),
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_lender_locale(
    pool: &PgPool,
    lender_id: &str,
    locale: Option<&str>,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE lenders
        SET
            locale = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        "#,
        locale,
        lender_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn store_totp_secret(pool: &PgPool, lender_id: &str, totp_secret: &str) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE lenders
        SET
            totp_secret = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        "#,
        totp_secret,
        lender_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn enable_totp(pool: &PgPool, lender_id: &str) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE lenders
        SET
            totp_enabled = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        "#,
        lender_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_totp_secret(pool: &PgPool, lender_id: &str) -> Result<Option<String>> {
    let row = sqlx::query!(
        r#"
        SELECT totp_secret, totp_enabled
        FROM lenders
        WHERE id = $1
        "#,
        lender_id,
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) if row.totp_enabled => Ok(row.totp_secret),
        _ => Ok(None),
    }
}

pub async fn get_totp_secret_for_setup(pool: &PgPool, lender_id: &str) -> Result<Option<String>> {
    let row = sqlx::query!(
        r#"
        SELECT totp_secret, totp_enabled
        FROM lenders
        WHERE id = $1
        "#,
        lender_id,
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => Ok(row.totp_secret),
        _ => Ok(None),
    }
}
