use crate::api_keys::ApiKeyHash;
use crate::db;
use crate::model;
use crate::model::PersonalReferralCode;
use anyhow::Context;
use anyhow::Result;
use rand::distributions::Alphanumeric;
use rand::Rng;
use rust_decimal::Decimal;
use sqlx::PgPool;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;

const VERIFICATION_CODE_LENGTH: usize = 6;

#[derive(Debug, Clone)]
pub struct Borrower {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub used_referral_code: Option<String>,
    pub first_time_discount_rate_referee: Option<Decimal>,
    pub timezone: Option<String>,
    pub locale: Option<String>,
    pub totp_enabled: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

fn new_model_borrower(
    borrower: Borrower,
    personal_referral_codes: Vec<PersonalReferralCode>,
) -> model::Borrower {
    model::Borrower {
        id: borrower.id,
        name: borrower.name,
        email: borrower.email,
        used_referral_code: borrower.used_referral_code,
        personal_referral_codes,
        first_time_discount_rate_referee: borrower.first_time_discount_rate_referee,
        timezone: borrower.timezone,
        locale: borrower.locale,
        totp_enabled: borrower.totp_enabled,
        created_at: borrower.created_at,
        updated_at: borrower.updated_at,
    }
}

/// Insert a new, pubkey-authenticated [`Borrower`].
///
/// Fails if a user with the provided email or pubkey already exists in the database table.
pub async fn register_pubkey_auth_user(
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    name: &str,
    email: &str,
) -> Result<model::Borrower> {
    let id = uuid::Uuid::new_v4().to_string();
    let email = email.to_ascii_lowercase();
    let email = email.trim();

    let row = sqlx::query!(
        r#"
        WITH inserted_borrower AS (
            INSERT INTO borrowers (id, name, email)
            VALUES ($1, $2, $3)
            RETURNING *
        )
        SELECT
            b.*,
            rb.referral_code as used_referral_code,
            rcb.first_time_discount_rate_referee
        FROM inserted_borrower b
        LEFT JOIN referred_borrowers rb ON rb.referred_borrower_id = b.id
        LEFT JOIN referral_codes_borrowers rcb ON rcb.code = rb.referral_code
        "#,
        id,
        name,
        email,
    )
    .fetch_one(&mut **db_tx)
    .await?;

    let borrower = Borrower {
        id,
        name: row.name,
        email: row.email,
        used_referral_code: row.used_referral_code,
        first_time_discount_rate_referee: row.first_time_discount_rate_referee,
        timezone: row.timezone,
        locale: row.locale,
        totp_enabled: false, // it's a new user, so it will be disabled
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    // Next, we enhance the borrower model with a personal code.
    let borrower = enhance_with_personal_code(&mut **db_tx, borrower).await?;

    Ok(borrower)
}

/// Insert a new, password-authenticated [`Borrower`].
///
/// Fails if a user with the provided email already exists in the database table.
pub async fn register_password_auth_user(
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    name: &str,
    email: &str,
    salt: &str,
    verifier: &str,
) -> Result<(model::Borrower, model::PasswordAuth)> {
    let id = uuid::Uuid::new_v4().to_string();
    let email = email.to_ascii_lowercase();
    let email = email.trim();
    let verification_code = generate_random_string(VERIFICATION_CODE_LENGTH);

    // First, get the user with used referral code info.
    //
    // Here we don't have to adjust the `first_time_discount_rate_referee` because the user can't
    // have any contracts yet.
    let row = sqlx::query!(
        r#"
        WITH inserted_borrower AS (
            INSERT INTO borrowers (id, name, email)
            VALUES ($1, $2, $3)
            RETURNING *
        ), inserted_auth AS (
            INSERT INTO borrowers_password_auth (borrower_id, email, salt, verifier, verification_code)
            VALUES ($1, $3, $4, $5, $6)
            RETURNING *
        )
        SELECT
            b.*,
            rb.referral_code as used_referral_code,
            rcb.first_time_discount_rate_referee
        FROM inserted_borrower b
        LEFT JOIN referred_borrowers rb ON rb.referred_borrower_id = b.id
        LEFT JOIN referral_codes_borrowers rcb ON rcb.code = rb.referral_code
    "#,
        id,
        name,
        email,
        salt,
        verifier,
        verification_code,
    )
    .fetch_one(&mut **db_tx)
        .await?;

    let borrower = Borrower {
        id,
        name: row.name,
        email: row.email,
        used_referral_code: row.used_referral_code,
        first_time_discount_rate_referee: row.first_time_discount_rate_referee,
        timezone: row.timezone,
        locale: row.locale,
        totp_enabled: false, // it's a new user, so it will be disabled
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    // Next, we enhance the borrower model with a personal code.
    let borrower = enhance_with_personal_code(&mut **db_tx, borrower).await?;

    let password_auth = model::PasswordAuth {
        borrower_id: row.id,
        email: email.to_string(),
        password: None,
        salt: salt.to_string(),
        verifier: verifier.to_string(),
        verified: false,
        verification_code: Some(verification_code),
        password_reset_token: None,
        password_reset_at: None,
    };

    Ok((borrower, password_auth))
}

/// Register a borrower for an API account.
///
/// The account is created via a creator API key.
pub async fn register_api_account(
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    name: &str,
    email: Option<&str>,
    timezone: Option<&str>,
    creator_api_id: i32,
    api_key_hash: &ApiKeyHash,
) -> Result<model::Borrower> {
    let borrower_id = uuid::Uuid::new_v4().to_string();
    let email = email.map(|email| email.to_ascii_lowercase().trim().to_string());
    let row = sqlx::query!(
        r#"
           INSERT INTO borrowers (id, name, email, timezone)
           VALUES ($1, $2, $3, $4)
           RETURNING *
        "#,
        borrower_id,
        name,
        email,
        timezone
    )
    .fetch_one(&mut **db_tx)
    .await?;

    // Insert into api_accounts_by_creators to establish the relationship
    sqlx::query!(
        r#"
           INSERT INTO api_accounts_by_creators (borrower_id, creator_api_key)
           VALUES ($1, $2)
        "#,
        borrower_id,
        creator_api_id
    )
    .execute(&mut **db_tx)
    .await?;

    db::api_keys::insert_borrower(&mut **db_tx, api_key_hash, &borrower_id, "account key").await?;

    // Not dealing with referral codes or discounts for API accounts (for now).

    let borrower = Borrower {
        id: borrower_id,
        name: row.name,
        email: row.email,
        used_referral_code: None,
        first_time_discount_rate_referee: None,
        timezone: row.timezone,
        locale: row.locale,
        totp_enabled: false,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    let borrower = new_model_borrower(borrower, vec![]);

    Ok(borrower)
}

pub enum RegisterAccountByokError {
    Database(anyhow::Error),
    UsedEmail,
}

/// Register a borrower for an API account.
///
/// THe borrower brings their own key (client-side generated API key).
pub async fn register_api_account_byok(
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    name: &str,
    email: &str,
    timezone: Option<&str>,
    api_key_hash: &ApiKeyHash,
) -> Result<model::Borrower, RegisterAccountByokError> {
    let borrower_id = uuid::Uuid::new_v4().to_string();
    let email = email.to_ascii_lowercase().trim().to_string();
    let res = sqlx::query!(
        r#"
           INSERT INTO borrowers (id, name, email, timezone)
           VALUES ($1, $2, $3, $4)
           RETURNING *
        "#,
        borrower_id,
        name,
        email,
        timezone
    )
    .fetch_one(&mut **db_tx)
    .await;

    let row = match res {
        Ok(row) => row,
        Err(e) => {
            if let Some(db_error) = e.as_database_error() {
                if matches!(db_error.kind(), sqlx::error::ErrorKind::UniqueViolation) {
                    return Err(RegisterAccountByokError::UsedEmail);
                }
            }

            return Err(RegisterAccountByokError::Database(e.into()));
        }
    };

    // TODO: We are not modelling the `UsedApiKey` error explicitly. But we probably don't want to
    // surface this to the client anyway.
    db::api_keys::insert_borrower(&mut **db_tx, api_key_hash, &borrower_id, "byok account key")
        .await
        .map_err(RegisterAccountByokError::Database)?;

    // Not dealing with referral codes or discounts for API accounts (for now).

    let borrower = Borrower {
        id: borrower_id,
        name: row.name,
        email: row.email,
        used_referral_code: None,
        first_time_discount_rate_referee: None,
        timezone: row.timezone,
        locale: row.locale,
        totp_enabled: false,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    let borrower = new_model_borrower(borrower, vec![]);

    Ok(borrower)
}

async fn enhance_with_personal_code<'a, E>(pool: E, base_user: Borrower) -> Result<model::Borrower>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    // Then get their personal referral code if it exists
    let personal_code = sqlx::query_as!(
        PersonalReferralCode,
        r#"
            SELECT
                code,
                active,
                first_time_discount_rate_referee,
                first_time_commission_rate_referrer,
                commission_rate_referrer,
                created_at,
                expires_at
            FROM referral_codes_borrowers
            WHERE referrer_id = $1
        "#,
        base_user.id
    )
    .fetch_all(pool)
    .await?;

    // Create the final user struct
    let borrower = new_model_borrower(base_user, personal_code);
    Ok(borrower)
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
        "UPDATE borrowers_password_auth
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

/// Update the legacy password hash stored in the `borrowers_password_auth` table.
pub async fn update_legacy_password<'a, E>(
    pool: E,
    borrower_id: &str,
    legacy_password: &str,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    use argon2::PasswordHasher;

    let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
    let legacy_password_hash = argon2::Argon2::default()
        .hash_password(legacy_password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| anyhow::anyhow!("Failed to hash password: {e}"))?;

    sqlx::query!(
        r#"UPDATE borrowers_password_auth
           SET password = $1
           WHERE borrower_id = $2
        "#,
        legacy_password_hash,
        borrower_id,
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
) -> Result<Option<(model::Borrower, model::PasswordAuth)>> {
    let email = email.to_ascii_lowercase();

    let maybe_row = sqlx::query!(
        r#"SELECT
           b.id as "id!",
           b.name as "name!",
           b.email,
           b.used_referral_code,
           b.first_time_discount_rate_referee,
           b.timezone,
           b.locale,
           b_auth.totp_enabled,
           b_auth.salt,
           b_auth.email as auth_email,
           b_auth.verifier,
           b_auth.password,
           b_auth.verified,
           b_auth.verification_code,
           b_auth.password_reset_token,
           b_auth.password_reset_at,
           b.created_at as "created_at!",
           b.updated_at as "updated_at!"
           FROM borrowers_password_auth b_auth
           LEFT JOIN borrower_discount_info b ON b.id = b_auth.borrower_id
           WHERE b_auth.email = $1
        "#,
        email
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    match maybe_row {
        Some(row) => {
            let borrower = Borrower {
                id: row.id.clone(),
                name: row.name,
                email: row.email,
                used_referral_code: row.used_referral_code,
                first_time_discount_rate_referee: row.first_time_discount_rate_referee,
                timezone: row.timezone,
                locale: row.locale,
                totp_enabled: row.totp_enabled,
                created_at: row.created_at,
                updated_at: row.updated_at,
            };

            let borrower = enhance_with_personal_code(pool, borrower).await?;

            let password_auth = model::PasswordAuth {
                borrower_id: row.id,
                email: row.auth_email,
                salt: row.salt,
                verifier: row.verifier,
                password: row.password,
                verified: row.verified,
                verification_code: row.verification_code,
                password_reset_token: row.password_reset_token,
                password_reset_at: row.password_reset_at,
            };

            Ok(Some((borrower, password_auth)))
        }
        None => Ok(None),
    }
}

pub async fn get_user_by_id(pool: &Pool<Postgres>, id: &str) -> Result<Option<model::Borrower>> {
    let maybe_row = sqlx::query!(
        r#"SELECT
           b.id as "id!",
           b.name as "name!",
           b.email,
           b.used_referral_code,
           b.first_time_discount_rate_referee,
           b.timezone,
           b.locale,
           COALESCE(b_auth.totp_enabled, FALSE) as "totp_enabled!",
           b.created_at as "created_at!",
           b.updated_at as "updated_at!"
           FROM borrower_discount_info b
           LEFT JOIN borrowers_password_auth b_auth ON b.id = b_auth.borrower_id
           WHERE b.id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    match maybe_row {
        Some(row) => {
            let borrower = Borrower {
                id: row.id,
                name: row.name,
                email: row.email,
                used_referral_code: row.used_referral_code,
                first_time_discount_rate_referee: row.first_time_discount_rate_referee,
                timezone: row.timezone,
                locale: row.locale,
                totp_enabled: row.totp_enabled,
                created_at: row.created_at,
                updated_at: row.updated_at,
            };

            Ok(Some(enhance_with_personal_code(pool, borrower).await?))
        }
        None => Ok(None),
    }
}

pub async fn get_password_auth_info_by_borrower_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<Option<model::PasswordAuth>> {
    let maybe_row = sqlx::query!(
        r#"SELECT
           borrower_id,
           email,
           salt,
           verifier,
           password,
           verified,
           verification_code,
           password_reset_token,
           password_reset_at
           FROM borrowers_password_auth
           WHERE borrower_id = $1
        "#,
        borrower_id,
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    match maybe_row {
        Some(row) => Ok(Some(model::PasswordAuth {
            borrower_id: row.borrower_id,
            email: row.email,
            salt: row.salt,
            verifier: row.verifier,
            password: row.password,
            verified: row.verified,
            verification_code: row.verification_code,
            password_reset_token: row.password_reset_token,
            password_reset_at: row.password_reset_at,
        })),
        None => Ok(None),
    }
}

pub async fn get_password_auth_info_by_verification_code(
    pool: &Pool<Postgres>,
    verification_code: &str,
) -> Result<Option<model::PasswordAuth>> {
    let verification_code = verification_code.to_ascii_lowercase();
    let maybe_row = sqlx::query!(
        r#"SELECT
           borrower_id,
           email,
           salt,
           verifier,
           password,
           verified,
           verification_code,
           password_reset_token,
           password_reset_at
           FROM borrowers_password_auth
           WHERE verification_code = $1
        "#,
        verification_code,
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    match maybe_row {
        Some(row) => Ok(Some(model::PasswordAuth {
            borrower_id: row.borrower_id,
            email: row.email,
            salt: row.salt,
            verifier: row.verifier,
            password: row.password,
            verified: row.verified,
            verification_code: row.verification_code,
            password_reset_token: row.password_reset_token,
            password_reset_at: row.password_reset_at,
        })),
        None => Ok(None),
    }
}

pub async fn verify_user(pool: &Pool<Postgres>, verification_code: &str) -> Result<()> {
    let verification_code = verification_code.to_ascii_lowercase();
    sqlx::query!(
        "UPDATE borrowers_password_auth SET verification_code = $1, verified = $2 WHERE verification_code = $3",
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
        "UPDATE borrowers_password_auth
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

/// Return a user by reset token.
///
/// Returns None if the reset token has already expired.
pub async fn get_password_auth_info_by_reset_token(
    pool: &Pool<Postgres>,
    password_reset_token: &str,
) -> Result<Option<model::PasswordAuth>> {
    let maybe_row = sqlx::query!(
        r#"SELECT
           borrower_id,
           email,
           salt,
           verifier,
           password,
           verified,
           verification_code,
           password_reset_token,
           password_reset_at
           FROM borrowers_password_auth
           WHERE password_reset_token = $1
        "#,
        password_reset_token,
    )
    .fetch_optional(pool)
    .await
    .context("failed loading")?;

    match maybe_row {
        Some(row) => Ok(Some(model::PasswordAuth {
            borrower_id: row.borrower_id,
            email: row.email,
            password: row.password,
            salt: row.salt,
            verifier: row.verifier,
            verified: row.verified,
            verification_code: row.verification_code,
            password_reset_token: row.password_reset_token,
            password_reset_at: row.password_reset_at,
        })),
        None => Ok(None),
    }
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

pub async fn update_borrower_timezone(
    pool: &PgPool,
    borrower_id: &str,
    timezone: &str,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE borrowers
        SET
            timezone = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        "#,
        timezone,
        borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_borrower_locale(
    pool: &PgPool,
    borrower_id: &str,
    locale: Option<&str>,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE borrowers
        SET
            locale = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        "#,
        locale,
        borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn store_totp_secret(pool: &PgPool, borrower_id: &str, totp_secret: &str) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE borrowers_password_auth
        SET
            totp_secret = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE borrower_id = $2
        "#,
        totp_secret,
        borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn enable_totp(pool: &PgPool, borrower_id: &str) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE borrowers_password_auth
        SET
            totp_enabled = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE borrower_id = $1
        "#,
        borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn disable_totp(pool: &PgPool, borrower_id: &str) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE borrowers_password_auth
        SET
            totp_secret = NULL,
            totp_enabled = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE borrower_id = $1
        "#,
        borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Returns the totp secret
///
/// This function differs slightly to `get_totp_secret_for_setup` as it **DOES** consider if totp is
/// enabled or not. It will only return a secret if  `totp_enabled` is true.
/// The reason for this is that the user might have cancelled a totp-setup once and has a
/// `totp_secret` in the database but `totp_enabled` is not enabled.
pub async fn get_totp_secret(pool: &PgPool, borrower_id: &str) -> Result<Option<String>> {
    let row = sqlx::query!(
        r#"
        SELECT totp_secret, totp_enabled
        FROM borrowers_password_auth
        WHERE borrower_id = $1
        "#,
        borrower_id,
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) if row.totp_enabled => Ok(row.totp_secret),
        _ => Ok(None),
    }
}

/// Returns the totp secret during the totp setup
///
/// This function differs slightly to `get_totp_secret` as it does not consider if totp is enabled
/// or not. The reason for this is that we only set `totp_enabled` to true, if the user verified the
/// first code (for which we need to load the secret). The reason for this is that the user might
/// have cancelled a totp-setup once and has a `totp_secret` in the database but `totp_enabled` is
/// not enabled.
pub async fn get_totp_secret_for_setup(pool: &PgPool, borrower_id: &str) -> Result<Option<String>> {
    let row = sqlx::query!(
        r#"
        SELECT totp_secret
        FROM borrowers_password_auth
        WHERE borrower_id = $1
        "#,
        borrower_id,
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => Ok(row.totp_secret),
        _ => Ok(None),
    }
}
