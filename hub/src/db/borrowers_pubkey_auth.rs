use anyhow::Context;
use anyhow::Result;
use sqlx::PgPool;
use sqlx::Postgres;

/// Model representing a pubkey-authenticated borrower.
#[derive(Debug, Clone)]
pub struct PubkeyAuth {
    pub borrower_id: String,
    pub pubkey: String,
    pub email: String,
    pub verified: bool,
}

/// Insert a new pubkey auth record for a borrower.
pub async fn insert_pubkey_auth(
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    borrower_id: &str,
    pubkey: &str,
    email: &str,
) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO borrowers_pubkey_auth (borrower_id, pubkey, email, verified)
        VALUES ($1, $2, $3, $4)
        "#,
        borrower_id,
        pubkey,
        email,
        false,
    )
    .execute(&mut **db_tx)
    .await?;

    Ok(())
}

/// Get a borrower's pubkey auth info by their public key.
pub async fn get_by_pubkey(pool: &PgPool, pubkey: &str) -> Result<Option<PubkeyAuth>> {
    let maybe_row = sqlx::query!(
        r#"
        SELECT borrower_id, pubkey, email, verified
        FROM borrowers_pubkey_auth
        WHERE pubkey = $1
        "#,
        pubkey
    )
    .fetch_optional(pool)
    .await
    .context("failed loading pubkey auth by pubkey")?;

    match maybe_row {
        Some(row) => Ok(Some(PubkeyAuth {
            borrower_id: row.borrower_id,
            pubkey: row.pubkey,
            email: row.email,
            verified: row.verified,
        })),
        None => Ok(None),
    }
}

/// Get a borrower's pubkey auth info by their borrower ID.
pub async fn get_by_borrower_id(pool: &PgPool, borrower_id: &str) -> Result<Option<PubkeyAuth>> {
    let maybe_row = sqlx::query!(
        r#"
        SELECT borrower_id, pubkey, email, verified
        FROM borrowers_pubkey_auth
        WHERE borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_optional(pool)
    .await
    .context("failed loading pubkey auth by borrower_id")?;

    match maybe_row {
        Some(row) => Ok(Some(PubkeyAuth {
            borrower_id: row.borrower_id,
            pubkey: row.pubkey,
            email: row.email,
            verified: row.verified,
        })),
        None => Ok(None),
    }
}

/// Check if a public key is already registered.
pub async fn pubkey_exists(pool: &PgPool, pubkey: &str) -> Result<bool> {
    let result = get_by_pubkey(pool, pubkey).await?;
    Ok(result.is_some())
}

/// Check if an email is already registered across all auth methods (pubkey, password, or in
/// borrowers table).
pub async fn email_exists_anywhere(pool: &PgPool, email: &str) -> Result<bool> {
    let email = email.to_ascii_lowercase();

    // Check borrowers_pubkey_auth
    let pubkey_auth_exists = sqlx::query!(
        r#"
        SELECT EXISTS(SELECT 1 FROM borrowers_pubkey_auth WHERE email = $1) as "exists!"
        "#,
        email
    )
    .fetch_one(pool)
    .await
    .context("failed checking borrowers_pubkey_auth for email")?
    .exists;

    if pubkey_auth_exists {
        return Ok(true);
    }

    // Check borrowers_password_auth
    let password_auth_exists = sqlx::query!(
        r#"
        SELECT EXISTS(SELECT 1 FROM borrowers_password_auth WHERE email = $1) as "exists!"
        "#,
        email
    )
    .fetch_one(pool)
    .await
    .context("failed checking borrowers_password_auth for email")?
    .exists;

    if password_auth_exists {
        return Ok(true);
    }

    // Check borrowers table (for API accounts that might have email)
    let borrowers_exists = sqlx::query!(
        r#"
        SELECT EXISTS(SELECT 1 FROM borrowers WHERE email = $1) as "exists!"
        "#,
        email
    )
    .fetch_one(pool)
    .await
    .context("failed checking borrowers for email")?
    .exists;

    Ok(borrowers_exists)
}
