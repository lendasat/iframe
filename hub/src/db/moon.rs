use crate::model::db;
use crate::moon;
use anyhow::Context;
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
            borrower_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

pub async fn get_all_card_ids(pool: &Pool<Postgres>) -> Result<Vec<Uuid>> {
    let cards: Vec<String> = sqlx::query_scalar!(
        r#"
    SELECT
        id
    FROM moon_cards
    "#
    )
    .fetch_all(pool)
    .await?;

    let vec = cards
        .iter()
        .map(|string_uuid| Uuid::from_str(string_uuid).expect("to be valid uuid"))
        .collect();
    Ok(vec)
}

pub async fn get_card_by_id(pool: &Pool<Postgres>, card_id: &str) -> Result<Option<moon::Card>> {
    let card = sqlx::query_as!(
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
            borrower_id
        FROM moon_cards
        where id = $1
        "#,
        card_id.to_string()
    )
    .fetch_optional(pool)
    .await?;

    Ok(card.map(moon::Card::from))
}

pub async fn insert_moon_invoice(pool: &Pool<Postgres>, invoice: &moon::Invoice) -> Result<()> {
    let id = invoice.id;
    sqlx::query!(
        r#"
        INSERT INTO moon_invoices (
            id,
            address,
            usd_amount_owed,
            contract_id,
            card_id,
            lender_id,
            borrower_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
        id,
        invoice.address,
        invoice.usd_amount_owed,
        invoice.contract_id,
        invoice.card_id.map(|c| c.to_string()),
        invoice.lender_id,
        invoice.borrower_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug)]
pub struct MoonInvoice {
    pub id: Uuid,
    pub address: String,
    pub usd_amount_owed: Decimal,
    pub contract_id: String,
    pub card_id: Option<String>,
    pub lender_id: String,
    pub borrower_id: String,
    pub is_paid: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

pub async fn get_invoice_by_id(
    pool: &Pool<Postgres>,
    invoice_id: Uuid,
) -> Result<Option<MoonInvoice>> {
    let invoice = sqlx::query_as!(
        MoonInvoice,
        r#"
        SELECT
            id,
            address,
            usd_amount_owed,
            contract_id,
            card_id,
            lender_id,
            borrower_id,
            is_paid,
            created_at,
            updated_at
        FROM moon_invoices
        WHERE id = $1
        "#,
        invoice_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(invoice)
}

pub async fn get_invoice_by_contract_id(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Option<MoonInvoice>> {
    let invoice = sqlx::query_as!(
        MoonInvoice,
        r#"
        SELECT
            id,
            address,
            usd_amount_owed,
            contract_id,
            card_id,
            lender_id,
            borrower_id,
            is_paid,
            created_at,
            updated_at
        FROM moon_invoices
        WHERE contract_id = $1
        "#,
        contract_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(invoice)
}

pub async fn mark_invoice_as_paid(pool: &Pool<Postgres>, invoice_id: Uuid) -> Result<bool> {
    let rows_affected = sqlx::query!(
        r#"
        UPDATE moon_invoices
        SET
            is_paid = true,
            updated_at = $2
        WHERE id = $1
        "#,
        invoice_id,
        OffsetDateTime::now_utc()
    )
    .execute(pool)
    .await?
    .rows_affected();

    Ok(rows_affected > 0)
}

pub async fn insert_moon_invoice_payment(
    pool: &Pool<Postgres>,
    invoice_payment_id: Uuid,
    invoice_id: Uuid,
    amount: &Decimal,
    currency: &str,
) -> Result<()> {
    let exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS (
            SELECT 1
            FROM moon_invoice_payments
            WHERE id = $1
        )
        "#,
        invoice_id
    )
    .fetch_one(pool)
    .await?;

    if exists.unwrap_or_default() {
        tracing::warn!(
            invoice_id = invoice_id.to_string(),
            invoice_payment_id = invoice_payment_id.to_string(),
            "Received already known payment invoice"
        );
        return Ok(());
    }

    sqlx::query!(
        r#"
        INSERT INTO moon_invoice_payments (
            id,
            invoice_id,
            amount,
            currency
        ) VALUES ($1, $2, $3, $4)
        "#,
        invoice_payment_id,
        invoice_id,
        amount,
        currency
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug)]
struct TransactionData {
    transaction_id: Uuid,
    card_public_id: String,
    transaction_status: TransactionStatus,
    datetime: String,
    merchant: String,
    amount: Decimal,
    ledger_currency: String,
    amount_fees_in_ledger_currency: Decimal,
    amount_in_transaction_currency: Decimal,
    transaction_currency: String,
    amount_fees_in_transaction_currency: Decimal,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "moon_transaction_status")]
pub enum TransactionStatus {
    Authorization,
    Reversal,
    Clearing,
    Refund,
    Pending,
    Settled,
    Unknown,
}

pub struct Fee {
    pub fee_type: String,
    pub amount: Decimal,
    pub fee_description: String,
    pub transaction_id: Uuid,
}

impl From<pay_with_moon::TransactionStatus> for TransactionStatus {
    fn from(value: pay_with_moon::TransactionStatus) -> Self {
        match value {
            pay_with_moon::TransactionStatus::Authorization => TransactionStatus::Authorization,
            pay_with_moon::TransactionStatus::Reversal => TransactionStatus::Reversal,
            pay_with_moon::TransactionStatus::Clearing => TransactionStatus::Clearing,
            pay_with_moon::TransactionStatus::Refund => TransactionStatus::Refund,
            pay_with_moon::TransactionStatus::Pending => TransactionStatus::Pending,
            pay_with_moon::TransactionStatus::Settled => TransactionStatus::Settled,
            pay_with_moon::TransactionStatus::Unknown(_) => TransactionStatus::Unknown,
        }
    }
}

impl From<TransactionStatus> for pay_with_moon::TransactionStatus {
    fn from(value: TransactionStatus) -> Self {
        match value {
            TransactionStatus::Authorization => pay_with_moon::TransactionStatus::Authorization,
            TransactionStatus::Reversal => pay_with_moon::TransactionStatus::Reversal,
            TransactionStatus::Clearing => pay_with_moon::TransactionStatus::Clearing,
            TransactionStatus::Refund => pay_with_moon::TransactionStatus::Refund,
            TransactionStatus::Pending => pay_with_moon::TransactionStatus::Pending,
            TransactionStatus::Settled => pay_with_moon::TransactionStatus::Settled,
            TransactionStatus::Unknown => {
                pay_with_moon::TransactionStatus::Unknown("unknown".to_string())
            }
        }
    }
}

impl From<pay_with_moon::TransactionData> for TransactionData {
    fn from(value: pay_with_moon::TransactionData) -> Self {
        Self {
            transaction_id: value.transaction_id,
            card_public_id: value.card.public_id.to_string(),
            transaction_status: value.transaction_status.into(),
            datetime: value.datetime,
            merchant: value.merchant,
            amount: value.amount,
            ledger_currency: value.ledger_currency,
            amount_fees_in_ledger_currency: value.amount_fees_in_ledger_currency,
            amount_in_transaction_currency: value.amount_in_transaction_currency,
            transaction_currency: value.transaction_currency,
            amount_fees_in_transaction_currency: value.amount_fees_in_transaction_currency,
        }
    }
}

impl Fee {
    pub fn new(
        fee_type: String,
        amount: Decimal,
        fee_description: String,
        transaction_id: Uuid,
    ) -> Self {
        Self {
            fee_type,
            amount,
            fee_description,
            transaction_id,
        }
    }
}

pub async fn insert_moon_transactions(
    pool: &Pool<Postgres>,
    message: pay_with_moon::MoonMessage,
) -> Result<()> {
    match message {
        pay_with_moon::MoonMessage::CardTransaction(tx)
        | pay_with_moon::MoonMessage::CardAuthorizationRefund(tx) => {
            // TODO: I believe we need to handle card authorization refund data separately
            insert_transaction_data(pool, tx)
                .await
                .context("Failed inserting transaction data")?;
        }
        pay_with_moon::MoonMessage::DeclineData(decline_data) => {
            insert_moon_message_decline_data(pool, decline_data)
                .await
                .context("Failed inserting decline data")?;
        }
        pay_with_moon::MoonMessage::MoonInvoicePayment(payment) => {
            insert_moon_invoice_payment(
                pool,
                payment.id,
                payment.invoice_id,
                &payment.amount,
                payment.currency.as_str(),
            )
            .await
            .context("Failed inserting invoice payment")?;
        }
        pay_with_moon::MoonMessage::Unknown(value) => {
            tracing::warn!(
                ?value,
                "Received unknown moon message which we can't persist"
            );
        }
    }

    Ok(())
}

pub async fn insert_transactions(
    pool: &Pool<Postgres>,
    txs: Vec<pay_with_moon::Transaction>,
) -> Result<()> {
    for tx in txs.into_iter() {
        match tx {
            pay_with_moon::Transaction::CardTransaction(tx)
            | pay_with_moon::Transaction::CardAuthorizationRefund(tx) => {
                insert_transaction_data(pool, tx).await?
            }
            pay_with_moon::Transaction::DeclineData(decline) => {
                insert_decline_data(pool, decline.into()).await?
            }
        }
    }

    Ok(())
}

pub async fn load_moon_transactions_by_card(
    pool: &Pool<Postgres>,
    card_id: Uuid,
) -> Result<Vec<pay_with_moon::Transaction>> {
    let tx_data = load_transaction_data_by_card_id(pool, card_id).await?;
    let decline_data = read_decline_data_by_card_id(pool, card_id).await?;

    let tx_data = tx_data
        .into_iter()
        .map(pay_with_moon::Transaction::CardTransaction);

    let decline_data = decline_data
        .into_iter()
        .map(pay_with_moon::Transaction::DeclineData);
    let all = tx_data.chain(decline_data).collect();
    Ok(all)
}

async fn insert_transaction_data(
    pool: &Pool<Postgres>,
    transaction_data: pay_with_moon::TransactionData,
) -> Result<()> {
    let tx_id = transaction_data.transaction_id;

    let fees = transaction_data
        .fees
        .clone()
        .into_iter()
        .map(|fee| Fee::new(fee.fee_type, fee.amount, fee.fee_description, tx_id))
        .collect::<Vec<_>>();

    let transaction_data = TransactionData::from(transaction_data);

    let mut db_tx = pool.begin().await?;

    sqlx::query_as!(
        InsertTransactionData,
        r#"
            INSERT INTO moon_transaction_data (
                transaction_id,
                card_public_id,
                transaction_status,
                datetime,
                merchant,
                amount,
                ledger_currency,
                amount_fees_in_ledger_currency,
                amount_in_transaction_currency,
                transaction_currency,
                amount_fees_in_transaction_currency
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (transaction_id) DO UPDATE
            SET
                card_public_id = EXCLUDED.card_public_id,
                transaction_status = EXCLUDED.transaction_status,
                datetime = EXCLUDED.datetime,
                merchant = EXCLUDED.merchant,
                amount = EXCLUDED.amount,
                ledger_currency = EXCLUDED.ledger_currency,
                amount_fees_in_ledger_currency = EXCLUDED.amount_fees_in_ledger_currency,
                amount_in_transaction_currency = EXCLUDED.amount_in_transaction_currency,
                transaction_currency = EXCLUDED.transaction_currency,
                amount_fees_in_transaction_currency = EXCLUDED.amount_fees_in_transaction_currency,
                updated_at = NOW()
        "#,
        transaction_data.transaction_id,
        transaction_data.card_public_id.to_string(),
        transaction_data.transaction_status as TransactionStatus,
        transaction_data.datetime,
        transaction_data.merchant,
        transaction_data.amount,
        transaction_data.ledger_currency,
        transaction_data.amount_fees_in_ledger_currency,
        transaction_data.amount_in_transaction_currency,
        transaction_data.transaction_currency,
        transaction_data.amount_fees_in_transaction_currency
    )
    .execute(&mut *db_tx)
    .await?;

    for fee in fees {
        sqlx::query!(
            r#"
                INSERT INTO moon_transaction_fees (
                    transaction_id,
                    fee_type,
                    amount,
                    fee_description
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT (transaction_id, fee_type)
                DO UPDATE SET
                    amount = EXCLUDED.amount,
                    fee_description = EXCLUDED.fee_description
            "#,
            tx_id,
            fee.fee_type,
            fee.amount,
            fee.fee_description
        )
        .execute(&mut *db_tx)
        .await
        .context("Failed inserting tx fee")?;
    }

    db_tx.commit().await?;
    Ok(())
}

async fn load_transaction_data_by_card_id(
    pool: &Pool<Postgres>,
    card_id: Uuid,
) -> Result<Vec<pay_with_moon::TransactionData>> {
    let transaction_data: Vec<TransactionData> = sqlx::query_as!(
        TransactionData,
        r#"
        SELECT
            transaction_id,
            card_public_id,
            transaction_status AS "transaction_status: TransactionStatus",
            datetime,
            merchant,
            amount,
            ledger_currency,
            amount_fees_in_ledger_currency,
            amount_in_transaction_currency,
            transaction_currency,
            amount_fees_in_transaction_currency
        FROM moon_transaction_data
        WHERE card_public_id = $1
        "#,
        card_id.to_string()
    )
    .fetch_all(pool)
    .await?;

    let mut return_value = vec![];
    for tx_data in transaction_data {
        let card = get_card_by_id(pool, tx_data.card_public_id.as_str())
            .await?
            .context(format!("Card not found {card_id}"))?;

        let fee_data: Vec<Fee> = sqlx::query_as!(
            Fee,
            r#"
        SELECT
            fee_type,
            amount,
            fee_description,
            transaction_id
        FROM moon_transaction_fees
        WHERE transaction_id = $1
        "#,
            tx_data.transaction_id
        )
        .fetch_all(pool)
        .await?;

        return_value.push(pay_with_moon::TransactionData {
            card: pay_with_moon::TransactionCard {
                public_id: card.id,
                // TODO: we are not storing this at the moment
                name: "".to_string(),
                // TODO: we are not storing this at the moment
                card_type: "Visa Card".to_string(),
            },
            transaction_id: tx_data.transaction_id,
            transaction_status: tx_data.transaction_status.into(),
            datetime: tx_data.datetime,
            merchant: tx_data.merchant,
            amount: tx_data.amount,
            ledger_currency: tx_data.ledger_currency,
            amount_fees_in_ledger_currency: tx_data.amount_fees_in_ledger_currency,
            amount_in_transaction_currency: tx_data.amount_in_transaction_currency,
            transaction_currency: tx_data.transaction_currency,
            amount_fees_in_transaction_currency: tx_data.amount_fees_in_transaction_currency,
            fees: fee_data
                .into_iter()
                .map(|fee| pay_with_moon::Fee {
                    fee_type: fee.fee_type,
                    amount: fee.amount,
                    fee_description: fee.fee_description,
                })
                .collect(),
        })
    }

    Ok(return_value)
}

#[derive(Debug)]
struct DeclineData {
    /// The date we receive has the following format: 2024-11-14 10:26:24
    pub message_id: i32,
    pub datetime: String,
    pub merchant: String,
    pub customer_friendly_description: String,
    pub amount: Decimal,
    pub card_public_id: String,
}

impl From<pay_with_moon::MoonMessageDeclineData> for DeclineData {
    fn from(value: pay_with_moon::MoonMessageDeclineData) -> Self {
        Self {
            message_id: value.id,
            datetime: value.created_at,
            merchant: value.merchant,
            customer_friendly_description: value.customer_friendly_description,
            amount: value.amount,
            card_public_id: value.card_public_id.to_string(),
        }
    }
}

impl From<pay_with_moon::DeclineData> for DeclineData {
    fn from(value: pay_with_moon::DeclineData) -> Self {
        Self {
            message_id: value.id,
            datetime: value.datetime,
            merchant: value.merchant,
            customer_friendly_description: value.customer_friendly_description,
            amount: value.amount,
            card_public_id: value.card_public_id.to_string(),
        }
    }
}

async fn insert_moon_message_decline_data(
    pool: &Pool<Postgres>,
    decline_data: pay_with_moon::MoonMessageDeclineData,
) -> Result<(), sqlx::Error> {
    let decline_data = DeclineData::from(decline_data);

    insert_decline_data(pool, decline_data).await
}

async fn insert_decline_data(
    pool: &Pool<Postgres>,
    decline_data: DeclineData,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO moon_transaction_decline_data (
            message_id,
            datetime,
            merchant,
            customer_friendly_description,
            amount,
            card_public_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        decline_data.message_id,
        decline_data.datetime,
        decline_data.merchant,
        decline_data.customer_friendly_description,
        decline_data.amount,
        decline_data.card_public_id.to_string()
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Loads DeclineData by card id from database
///
/// Note: while we insert the `[pay_with_moon::MoonMessageDeclineData]` we return
/// `[pay_with_moon::DeclineData]`, this is because moon has two different types of it and we want
/// to use only one here.
async fn read_decline_data_by_card_id(
    pool: &Pool<Postgres>,
    card_id: Uuid,
) -> Result<Vec<pay_with_moon::DeclineData>> {
    let decline_data: Vec<DeclineData> = sqlx::query_as!(
        DeclineData,
        r#"
        SELECT
            message_id,
            datetime,
            merchant,
            customer_friendly_description,
            amount,
            card_public_id
        FROM moon_transaction_decline_data
        WHERE card_public_id = $1
        "#,
        card_id.to_string()
    )
    .fetch_all(pool)
    .await?;

    let res = decline_data
        .into_iter()
        .map(|data| pay_with_moon::DeclineData {
            id: data.message_id,
            datetime: data.datetime,
            merchant: data.merchant,
            customer_friendly_description: data.customer_friendly_description,
            amount: data.amount,
            card_public_id: card_id,
            card_id,
            card: pay_with_moon::TransactionCard {
                public_id: card_id,
                // TODO: we do not store this information yet
                name: "".to_string(),
                // TODO: we do not store this information yet
                card_type: "".to_string(),
            },
        })
        .collect();

    Ok(res)
}
