use sqlx::postgres::PgPool;
use thiserror::Error;

#[derive(Debug, sqlx::Type, Clone, Copy)]
#[sqlx(type_name = "waitlist_role", rename_all = "lowercase")]
pub enum WaitlistRole {
    Borrower,
    Lender,
}

#[derive(Error, Debug)]
pub enum Error {
    #[error("Email {0} is already in use")]
    EmailInUse(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
}

pub async fn insert_into_waitlist(
    pool: &PgPool,
    email: &str,
    role: WaitlistRole,
) -> Result<(), Error> {
    // First check if the email + role combination already exists
    let existing = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM waitlist
        WHERE email = $1 AND role = $2
        "#,
        email,
        role as WaitlistRole
    )
    .fetch_one(pool)
    .await;

    // Handle potential error in the check query
    let count = match existing {
        Ok(record) => record.count.unwrap_or(0),
        Err(err) => return Err(Error::DatabaseError(err)),
    };

    // If the combination already exists, return the appropriate error
    if count > 0 {
        return Err(Error::EmailInUse(email.to_string()));
    }

    sqlx::query!(
        r#"
        INSERT INTO waitlist 
            (email, role)
        VALUES 
            ($1, $2)
        "#,
        email,
        role as WaitlistRole
    )
    .execute(pool)
    .await
    .map_err(Error::DatabaseError)?;

    Ok(())
}
