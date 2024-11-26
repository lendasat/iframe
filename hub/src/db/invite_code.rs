use crate::model::InviteCode;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn load_invite_code_borrower(
    pool: &Pool<Postgres>,
    code: &str,
) -> Result<Option<InviteCode>> {
    let invite_code = sqlx::query_as!(
        InviteCode,
        "SELECT id, active, code FROM INVITE_CODES_BORROWER WHERE code = $1",
        code
    )
    .fetch_optional(pool)
    .await?;

    Ok(invite_code)
}
pub async fn deactive_invite_code_borrower(pool: &Pool<Postgres>, code: &str) -> Result<()> {
    sqlx::query_as!(
        InviteCode,
        "UPDATE INVITE_CODES_BORROWER set active = false WHERE code = $1 ",
        code
    )
    .fetch_optional(pool)
    .await?;

    Ok(())
}

pub async fn load_invite_code_lender(
    pool: &Pool<Postgres>,
    code: &str,
) -> Result<Option<InviteCode>> {
    let invite_code = sqlx::query_as!(
        InviteCode,
        "SELECT id, active, code FROM INVITE_CODES_LENDER WHERE code = $1",
        code
    )
    .fetch_optional(pool)
    .await?;

    Ok(invite_code)
}
