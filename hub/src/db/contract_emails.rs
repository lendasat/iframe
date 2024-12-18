use crate::model::db;
use crate::model::ContractEmails;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn start_tracking_contract_emails<'a, E>(
    pool: E,
    contract_id: &str,
) -> Result<ContractEmails>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let contract_id = contract_id.to_string();

    let contract_emails = sqlx::query_as!(
        db::ContractEmails,
        r#"
        INSERT INTO contract_emails (
            contract_id
        ) VALUES ($1)
        RETURNING
            contract_id,
            loan_request_sent,
            loan_request_approved_sent,
            loan_request_rejected_sent,
            collateral_funded_sent,
            loan_paid_out_sent,
            loan_repaid_sent
        "#,
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract_emails.into())
}

pub async fn load_contract_emails(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<ContractEmails> {
    let contract_id = contract_id.to_string();

    let contract_emails = sqlx::query_as!(
        db::ContractEmails,
        r#"
        SELECT
            contract_id,
            loan_request_sent,
            loan_request_approved_sent,
            loan_request_rejected_sent,
            collateral_funded_sent,
            loan_paid_out_sent,
            loan_repaid_sent
        FROM contract_emails
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract_emails.into())
}

pub async fn mark_collateral_funded_as_sent(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    let contract_id = contract_id.to_string();

    sqlx::query!(
        r#"
        UPDATE contract_emails
        SET collateral_funded_sent = true
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_loan_request_as_sent(pool: &Pool<Postgres>, contract_id: &str) -> Result<()> {
    let contract_id = contract_id.to_string();

    sqlx::query!(
        r#"
        UPDATE contract_emails
        SET loan_request_sent = true
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_loan_request_approved_as_sent(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    let contract_id = contract_id.to_string();

    sqlx::query!(
        r#"
        UPDATE contract_emails
        SET loan_request_approved_sent = true
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_loan_request_rejected_as_sent(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    let contract_id = contract_id.to_string();

    sqlx::query!(
        r#"
        UPDATE contract_emails
        SET loan_request_rejected_sent = true
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_loan_paid_out_as_sent(pool: &Pool<Postgres>, contract_id: &str) -> Result<()> {
    let contract_id = contract_id.to_string();

    sqlx::query!(
        r#"
        UPDATE contract_emails
        SET loan_paid_out_sent = true
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_loan_repaid_as_sent(pool: &Pool<Postgres>, contract_id: &str) -> Result<()> {
    let contract_id = contract_id.to_string();

    sqlx::query!(
        r#"
        UPDATE contract_emails
        SET loan_repaid_sent = true
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_defaulted_loan_liquidated_as_sent(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    let contract_id = contract_id.to_string();

    sqlx::query!(
        r#"
        UPDATE contract_emails
        SET defaulted_loan_liquidated_sent = true
        WHERE contract_id = $1
        "#,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}
