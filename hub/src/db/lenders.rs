use crate::model::User;
use anyhow::anyhow;
use anyhow::Result;
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::SaltString;
use argon2::Argon2;
use argon2::PasswordHasher;
use rand::distributions::Alphanumeric;
use rand::Rng;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;

const VERIFICATION_CODE_LENGTH: usize = 20;

/// Inserts a new user and returns said user
///
/// Fails if user with provided email already exists
pub async fn register_user(
    pool: &Pool<Postgres>,
    name: &str,
    email: &str,
    password: &str,
) -> Result<User> {
    let hashed_password = generate_hashed_password(password)?;
    let verification_code = generate_random_string(VERIFICATION_CODE_LENGTH);

    let id = uuid::Uuid::new_v4().to_string();
    let user: User = sqlx::query_as!(
        User,
        "INSERT INTO lenders (id, name, email, password, verification_code)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *",
        id,
        name,
        email.to_ascii_lowercase(),
        hashed_password,
        verification_code,
    )
    .fetch_one(pool)
    .await?;
    Ok(user)
}

pub async fn user_exists(pool: &Pool<Postgres>, email: &str) -> Result<bool> {
    let maybe_user = get_user_by_email(pool, email).await?;

    Ok(maybe_user.is_some())
}

pub async fn get_user_by_email(pool: &Pool<Postgres>, email: &str) -> Result<Option<User>> {
    let email = email.to_ascii_lowercase();
    let maybe_user = sqlx::query_as!(User, "SELECT * FROM lenders WHERE email = $1", email)
        .fetch_optional(pool)
        .await?;
    Ok(maybe_user)
}
pub async fn get_user_by_id(pool: &Pool<Postgres>, id: &str) -> Result<Option<User>> {
    let maybe_user = sqlx::query_as!(User, "SELECT * FROM lenders WHERE id = $1", id)
        .fetch_optional(pool)
        .await?;
    Ok(maybe_user)
}

pub async fn get_user_by_verification_code(
    pool: &Pool<Postgres>,
    verification_code: &str,
) -> Result<Option<User>> {
    let maybe_user = sqlx::query_as!(
        User,
        "SELECT * FROM lenders WHERE verification_code = $1",
        verification_code
    )
    .fetch_optional(pool)
    .await?;
    Ok(maybe_user)
}

pub async fn verify_user(pool: &Pool<Postgres>, verification_code: &str) -> Result<()> {
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
) -> Result<Option<User>> {
    let maybe_user = sqlx::query_as!(
        User,
        "SELECT *
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

pub async fn update_user_password(
    pool: &Pool<Postgres>,
    password: &str,
    email: &str,
) -> Result<()> {
    let hashed_password = generate_hashed_password(password)?;
    sqlx::query!(
        "UPDATE lenders
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

pub fn generate_random_string(length: usize) -> String {
    let rng = rand::thread_rng();
    let random_string: String = rng
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect();

    random_string
}
