use crate::model::db;
use crate::moon;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

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
            lender_id
        ) VALUES ($1, $2, $3, $4, $5)
        "#,
        id,
        invoice.address,
        invoice.usd_amount_owed,
        invoice.contract_id,
        invoice.lender_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}
