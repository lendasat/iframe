use crate::model;
use anyhow::Context;
use anyhow::Result;
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
    pub salt: String,
    pub verifier: String,
    pub password: Option<String>,
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
) -> model::Borrower {
    model::Borrower {
        id: borrower.id,
        name: borrower.name,
        email: borrower.email,
        salt: borrower.salt,
        verifier: borrower.verifier,
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
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    name: &str,
    email: &str,
    salt: &str,
    verifier: &str,
) -> Result<model::Borrower> {
    let id = uuid::Uuid::new_v4().to_string();
    let verification_code = generate_random_string(VERIFICATION_CODE_LENGTH);

    // First get the user with used referral code info
    // here we don't have to adjust the `first_time_discount_rate_referee` because the user can't
    // have any contracts yet
    let base_user = sqlx::query_as!(
        Borrower,
        r#"
        WITH inserted AS (
            INSERT INTO borrowers (id, name, email, salt, verifier, verification_code)
            VALUES ($1, $2, $3, $4, $5, $6)
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
        salt,
        verifier,
        verification_code,
    )
    .fetch_one(&mut **db_tx)
    .await?;

    // next we enhance it with a personal code
    let borrower = enhance_with_personal_code(&mut **db_tx, base_user).await?;

    Ok(borrower)
}

async fn enhance_with_personal_code<'a, E>(pool: E, base_user: Borrower) -> Result<model::Borrower>
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

/// Insert the `salt` and `verifier` needed to authenticate a borrower via PAKE.
///
/// Also erases the `password` (hash) from the borrower row, since it will never be used for
/// authentication again.
///
/// The upgrade can only happen if the `salt` and `verifier` columns are set to their default values
/// of '0'. The default value indicates that the account was created before the upgrade to PAKE.
pub async fn upgrade_to_pake<'a, E>(pool: E, email: &str, salt: &str, verifier: &str) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        "UPDATE borrowers
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

/// Replace `salt` and `verifier` needed to authenticate a borrower via PAKE. This is used when the
/// borrower wants to change their password.
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
        "UPDATE borrowers
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

pub async fn get_user_by_email(
    pool: &Pool<Postgres>,
    email: &str,
) -> Result<Option<model::Borrower>> {
    let email = email.to_ascii_lowercase();
    // TODO: try to merge the `enhance` part again
    let maybe_base_user = sqlx::query_as!(
        model::Borrower,
        r#"SELECT
           id as "id!",
           name as "name!",
           email as "email!",
           salt as "salt!",
           verifier as "verifier!",
           password,
           verified as "verified!",
           verification_code,
           password_reset_token,
           used_referral_code,
           personal_referral_code,
           first_time_discount_rate_referee,
           password_reset_at,
           created_at as "created_at!",
           updated_at as "updated_at!"
           FROM borrower_discount_info where email = $1
        "#,
        email
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    Ok(maybe_base_user)
}
pub async fn get_user_by_id(pool: &Pool<Postgres>, id: &str) -> Result<Option<model::Borrower>> {
    let maybe_base_user = sqlx::query_as!(
        model::Borrower,
        r#"SELECT
           id as "id!",
           name as "name!",
           email as "email!",
           salt as "salt!",
           verifier as "verifier!",
           password,
           verified as "verified!",
           verification_code,
           password_reset_token,
           used_referral_code,
           personal_referral_code,
           first_time_discount_rate_referee,
           password_reset_at,
           created_at as "created_at!",
           updated_at as "updated_at!"
           FROM borrower_discount_info where id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    Ok(maybe_base_user)
}
pub async fn get_user_by_verification_code(
    pool: &Pool<Postgres>,
    verification_code: &str,
) -> Result<Option<model::Borrower>> {
    let verification_code = verification_code.to_ascii_lowercase();
    let maybe_base_user = sqlx::query_as!(
        model::Borrower,
        r#"SELECT
           id as "id!",
           name as "name!",
           email as "email!",
           salt as "salt!",
           verifier as "verifier!",
           password,
           verified as "verified!",
           verification_code,
           password_reset_token,
           used_referral_code,
           personal_referral_code,
           first_time_discount_rate_referee,
           password_reset_at,
           created_at as "created_at!",
           updated_at as "updated_at!"
           FROM borrower_discount_info where verification_code = $1
        "#,
        verification_code
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    Ok(maybe_base_user)
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
) -> Result<Option<model::Borrower>> {
    let maybe_base_user = sqlx::query_as!(
        model::Borrower,
        r#"SELECT
           id as "id!",
           name as "name!",
           email as "email!",
           salt as "salt!",
           verifier as "verifier!",
           password,
           verified as "verified!",
           verification_code,
           password_reset_token,
           used_referral_code,
           personal_referral_code,
           first_time_discount_rate_referee,
           password_reset_at,
           created_at as "created_at!",
           updated_at as "updated_at!"
           FROM borrower_discount_info where password_reset_token = $1
        "#,
        password_reset_token
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    Ok(maybe_base_user)
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
