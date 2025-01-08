use crate::model::InviteCode;
use crate::model::Lender;
use anyhow::Result;
use rand::distributions::Alphanumeric;
use rand::Rng;
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
        email.to_ascii_lowercase(),
        salt,
        verifier,
        verification_code,
        invite_code,
    )
    .fetch_one(pool)
    .await?;
    Ok(user)
}

/// Insert the `salt` and `verifier` needed to authenticate a lender via PAKE.
///
/// Also erases the `password` (hash) from the lender row, since it will never be used for
/// authentication again.
///
/// The upgrade can only happen if the `salt` and `verifier` columns are set to their default values
/// of '0'. The default value indicates that the account was created before the upgrade to PAKE.
pub async fn upgrade_to_pake<'a, E>(pool: E, email: &str, salt: &str, verifier: &str) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        "UPDATE lenders
        SET salt = $1,
            verifier = $2,
            password = null
        WHERE email = $3 AND salt = '0' and verifier = '0'",
        salt,
        verifier,
        email
    )
    .execute(pool)
    .await?;
    Ok(())
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
            verification_code,
            invite_code,
            password_reset_token,
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
