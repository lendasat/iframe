use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::Txid;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;

/// A Bitcoin repayment invoice for paying installments with Bitcoin instead of the contract's loan
/// asset.
#[derive(Debug, Clone)]
pub struct BitcoinInvoice {
    pub id: Uuid,
    /// Reference to the installment being paid.
    pub installment_id: Uuid,
    /// Amount to be paid in Bitcoin.
    ///
    /// Computed when the invoice is generated.
    pub amount: Amount,
    /// Invoice amount in USD.
    pub amount_usd: Decimal,
    /// Bitcoin address where the payment should be sent.
    pub address: Address,
    /// When this invoice expires (15 minutes from creation)
    pub expires_at: OffsetDateTime,
    pub status: BitcoinInvoiceStatus,
    /// Bitcoin transaction ID of the payment.
    ///
    /// This is set when the borrower reports payment of the installment.
    pub txid: Option<Txid>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

/// Status of a Bitcoin repayment invoice.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BitcoinInvoiceStatus {
    /// Invoice is pending payment
    Pending,
    /// Payment has been reported by borrower but not yet confirmed by lender
    Paid,
    /// Payment has been confirmed by lender
    Confirmed,
}

impl BitcoinInvoice {
    pub fn new(
        now: OffsetDateTime,
        installment_id: Uuid,
        amount: Amount,
        amount_usd: Decimal,
        address: Address,
    ) -> Self {
        let id = Uuid::new_v4();
        let expires_at = now + time::Duration::minutes(15);

        Self {
            id,
            installment_id,
            amount,
            amount_usd,
            address,
            expires_at,
            status: BitcoinInvoiceStatus::Pending,
            txid: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Check if the invoice has expired.
    pub fn is_expired(&self, now: OffsetDateTime) -> bool {
        now >= self.expires_at
    }

    /// Check if the invoice is in a state that allows payment reporting.
    pub fn can_report_payment(&self) -> bool {
        matches!(self.status, BitcoinInvoiceStatus::Pending)
    }
}
