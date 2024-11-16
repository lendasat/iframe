use crate::model::db;
use crate::moon;
use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn insert_card(pool: &Pool<Postgres>, card: moon::Card) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO moon_cards (
            id,
            balance,
            available_balance,
            expiration,
            pan,
            cvv,
            support_token,
            product_id,
            end_customer_id,
            contract_id,
            borrower_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
        card.id.to_string(),
        card.balance,
        card.available_balance,
        card.expiration,
        card.pan,
        card.cvv,
        card.support_token,
        card.product_id.to_string(),
        card.end_customer_id,
        card.contract_id,
        card.borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_borrower_cards(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<Vec<moon::Card>> {
    let cards = sqlx::query_as!(
        db::MoonCard,
        r#"
        SELECT
            id,
            balance,
            available_balance,
            expiration,
            pan,
            cvv,
            support_token,
            product_id,
            end_customer_id,
            contract_id,
            borrower_id
        FROM moon_cards
        where borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_all(pool)
    .await?;

    let cards = cards.into_iter().map(moon::Card::from).collect();

    Ok(cards)
}

pub async fn insert_moon_invoice(pool: &Pool<Postgres>, invoice: &moon::Invoice) -> Result<()> {
    let id = invoice.id as i64;
    sqlx::query!(
        r#"
        INSERT INTO moon_invoices (
            id,
            address,
            usd_amount_owed,
            contract_id,
            lender_id,
            borrower_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        id,
        invoice.address,
        invoice.usd_amount_owed,
        invoice.contract_id,
        invoice.lender_id,
        invoice.borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug)]
pub struct MoonInvoice {
    pub id: i64,
    pub address: String,
    pub usd_amount_owed: Decimal,
    pub contract_id: String,
    pub lender_id: String,
    pub borrower_id: String,
    pub is_paid: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

pub async fn get_invoice_by_id(
    pool: &Pool<Postgres>,
    invoice_id: u64,
) -> Result<Option<MoonInvoice>> {
    let invoice = sqlx::query_as!(
        MoonInvoice,
        r#"
        SELECT 
            id,
            address,
            usd_amount_owed,
            contract_id,
            lender_id,
            borrower_id,
            is_paid,
            created_at,
            updated_at
        FROM moon_invoices 
        WHERE id = $1
        "#,
        invoice_id as i64
    )
    .fetch_optional(pool)
    .await?;

    Ok(invoice)
}

pub async fn mark_invoice_as_paid(pool: &Pool<Postgres>, invoice_id: u64) -> Result<bool> {
    let rows_affected = sqlx::query!(
        r#"
        UPDATE moon_invoices 
        SET 
            is_paid = true,
            updated_at = $2
        WHERE id = $1
        "#,
        invoice_id as i64,
        OffsetDateTime::now_utc()
    )
    .execute(pool)
    .await?
    .rows_affected();

    Ok(rows_affected > 0)
}

pub async fn insert_moon_invoice_payment(
    pool: &Pool<Postgres>,
    invoice_id: u64,
    amount: &Decimal,
    currency: &str,
) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO moon_invoice_payments (
            invoice_id,
            amount,
            currency
        ) VALUES ($1, $2, $3)
        "#,
        invoice_id as i64,
        amount,
        currency
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn assign_contract_to_card(
    pool: &Pool<Postgres>,
    card_id: Uuid,
    contract_id: String,
) -> Result<()> {
    sqlx::query!(
        r#"
           INSERT INTO card_contract_assignments (card_id, contract_id)
           VALUES ($1, $2)
           "#,
        card_id.to_string(),
        contract_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_card_id_by_contract(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Option<Uuid>> {
    let record = sqlx::query!(
        r#"
           SELECT card_id
           FROM card_contract_assignments
           WHERE contract_id = $1
           "#,
        contract_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(record.map(|r| Uuid::from_str(r.card_id.as_str()).expect("to be uuid")))
}
