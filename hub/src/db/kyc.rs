use anyhow::Result;
use sqlx::Postgres;

/// Get the KYC info for the given lender-borrower pair, if it exists.
///
/// # Returns
///
/// If there is a row for the given lender-borrower pair, returns a boolean indicating whether the
/// KYC process between the two parties is complete or not. Otherwise, returns [`None`].
pub async fn get<'a, E>(tx: E, lender_id: &str, borrower_id: &str) -> Result<Option<bool>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let is_kyc_done = sqlx::query_scalar!(
        r#"
            SELECT is_done
            FROM kyc
            WHERE lender_id = $1 AND borrower_id = $2
        "#,
        lender_id,
        borrower_id,
    )
    .fetch_optional(tx)
    .await?;

    Ok(is_kyc_done)
}

/// Attempt to record a KYC process between a lender and a borrower.
///
/// There can only be one KYC process per lender-borrower pair. If we encounter a conflict, we do
/// nothing.
///
/// # Returns
///
/// Returns a boolean indicating whether the KYC process is complete or not.
pub async fn insert<'a, E>(tx: E, lender_id: &str, borrower_id: &str) -> Result<bool>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let is_kyc_done = sqlx::query_scalar!(
        r#"
            INSERT INTO kyc (lender_id, borrower_id, is_done)
            VALUES ($1, $2, false)
            ON CONFLICT (lender_id, borrower_id) DO UPDATE SET is_done = kyc.is_done
            RETURNING is_done
        "#,
        lender_id,
        borrower_id,
    )
    .fetch_one(tx)
    .await?;

    Ok(is_kyc_done)
}

/// Attempt to record a KYC process between a lender and a borrower.
///
/// There can only be one KYC process per lender-borrower pair. If we encounter a conflict, we do
/// nothing.
///
/// # Returns
///
/// Returns a boolean indicating whether the KYC process is complete or not.
pub async fn approve<'a, E>(tx: E, lender_id: &str, borrower_id: &str) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        r#"
            UPDATE kyc
            SET is_done = true
            WHERE lender_id = $1 AND borrower_id = $2
        "#,
        lender_id,
        borrower_id,
    )
    .execute(tx)
    .await?;

    Ok(())
}
