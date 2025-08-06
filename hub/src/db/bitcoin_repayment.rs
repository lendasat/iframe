use crate::model;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::Txid;
use rust_decimal::Decimal;
use sqlx::FromRow;
use sqlx::PgPool;
use sqlx::Postgres;
use std::str::FromStr;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct BitcoinInvoice {
    pub id: Uuid,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub txid: Option<String>,
    pub amount_sats: i64,
    pub amount_usd: Decimal,
    pub installment_id: Uuid,
    pub address: String,
    pub expires_at: OffsetDateTime,
    pub status: BitcoinInvoiceStatus,
}

#[derive(Debug, Clone, Copy, sqlx::Type)]
#[sqlx(type_name = "btc_invoice_status")]
pub enum BitcoinInvoiceStatus {
    Pending,
    Paid,
    Confirmed,
}

/// Insert a new Bitcoin repayment invoice.
pub async fn insert<'a, E>(db: E, invoice: model::BitcoinInvoice) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let db_invoice: BitcoinInvoice = invoice.into();

    sqlx::query!(
        r#"
        INSERT INTO btc_invoices
        (id, created_at, updated_at, txid, amount_sats, amount_usd, installment_id, address, expires_at, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
        db_invoice.id,
        db_invoice.created_at,
        db_invoice.updated_at,
        db_invoice.txid,
        db_invoice.amount_sats,
        db_invoice.amount_usd,
        db_invoice.installment_id,
        db_invoice.address,
        db_invoice.expires_at,
        db_invoice.status as BitcoinInvoiceStatus
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Find a Bitcoin repayment invoice by ID.
pub async fn get_by_id(db: &PgPool, id: Uuid) -> Result<Option<model::BitcoinInvoice>> {
    let result = sqlx::query_as!(
        BitcoinInvoice,
        r#"
        SELECT
            id,
            created_at,
            updated_at,
            txid,
            amount_sats,
            amount_usd,
            installment_id,
            address,
            expires_at,
            status AS "status: BitcoinInvoiceStatus"
        FROM btc_invoices
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(db)
    .await?;

    Ok(result.map(Into::into))
}

/// Get the first non-expired pending invoice for the given installment
pub async fn get_first_non_expired_pending_invoice(
    db: &PgPool,
    installment_id: Uuid,
    now: OffsetDateTime,
) -> Result<Option<model::BitcoinInvoice>> {
    let result = sqlx::query_as!(
        BitcoinInvoice,
        r#"
        SELECT
            id,
            created_at,
            updated_at,
            txid,
            amount_sats,
            amount_usd,
            installment_id,
            address,
            expires_at,
            status AS "status: BitcoinInvoiceStatus"
        FROM btc_invoices
        WHERE installment_id = $1
            AND status = 'Pending'
            AND expires_at > $2
        ORDER BY created_at ASC
        LIMIT 1
        "#,
        installment_id,
        now
    )
    .fetch_optional(db)
    .await?;

    Ok(result.map(Into::into))
}

/// Update an invoice to mark it as paid with a transaction ID
pub async fn mark_as_paid<'a, E>(db: E, id: Uuid, txid: Txid) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let now = OffsetDateTime::now_utc();

    sqlx::query!(
        r#"
        UPDATE btc_invoices
        SET status = 'Paid', txid = $2, updated_at = $3
        WHERE id = $1
        "#,
        id,
        txid.to_string(),
        now
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update a paid invoice to mark it as confirmed.
pub async fn mark_as_confirmed<'a, E>(db: E, id: Uuid) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let now = OffsetDateTime::now_utc();

    sqlx::query!(
        r#"
        UPDATE btc_invoices
        SET status = 'Confirmed', updated_at = $2
        WHERE id = $1 AND status = 'Paid'
        "#,
        id,
        now
    )
    .execute(db)
    .await?;

    Ok(())
}

impl From<BitcoinInvoice> for model::BitcoinInvoice {
    fn from(value: BitcoinInvoice) -> Self {
        Self {
            id: value.id,
            created_at: value.created_at,
            updated_at: value.updated_at,
            txid: value.txid.and_then(|s| s.parse().ok()),
            amount: Amount::from_sat(value.amount_sats as u64),
            amount_usd: value.amount_usd,
            installment_id: value.installment_id,
            address: Address::<NetworkUnchecked>::from_str(&value.address)
                .expect("valid address in database")
                .assume_checked(),
            expires_at: value.expires_at,
            status: value.status.into(),
        }
    }
}

impl From<model::BitcoinInvoice> for BitcoinInvoice {
    fn from(value: model::BitcoinInvoice) -> Self {
        Self {
            id: value.id,
            created_at: value.created_at,
            updated_at: value.updated_at,
            txid: value.txid.map(|t| t.to_string()),
            amount_sats: value.amount.to_sat() as i64,
            amount_usd: value.amount_usd,
            installment_id: value.installment_id,
            address: value.address.to_string(),
            expires_at: value.expires_at,
            status: value.status.into(),
        }
    }
}

impl From<model::BitcoinInvoiceStatus> for BitcoinInvoiceStatus {
    fn from(value: model::BitcoinInvoiceStatus) -> Self {
        match value {
            model::BitcoinInvoiceStatus::Pending => Self::Pending,
            model::BitcoinInvoiceStatus::Paid => Self::Paid,
            model::BitcoinInvoiceStatus::Confirmed => Self::Confirmed,
        }
    }
}

impl From<BitcoinInvoiceStatus> for model::BitcoinInvoiceStatus {
    fn from(value: BitcoinInvoiceStatus) -> Self {
        match value {
            BitcoinInvoiceStatus::Pending => Self::Pending,
            BitcoinInvoiceStatus::Paid => Self::Paid,
            BitcoinInvoiceStatus::Confirmed => Self::Confirmed,
        }
    }
}
