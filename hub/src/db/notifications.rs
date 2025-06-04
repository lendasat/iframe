mod lender;

use crate::db::installments::InstallmentStatus;
use crate::model::db::ContractStatus;
pub use lender::*;
use time::OffsetDateTime;
use uuid::Uuid;

// Struct to represent the notification data
#[derive(Debug)]
pub struct ContractUpdateNotification {
    pub id: Uuid,
    pub contract_id: String,
    pub status: ContractStatus,
    pub read: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

// Struct to represent the chat message notification data
#[derive(Debug)]
pub struct ContractChatMessageNotification {
    pub id: Uuid,
    pub contract_id: String,
    pub borrower_name: String,
    pub read: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug)]
pub struct InstallmentUpdateNotification {
    pub id: Uuid,
    pub installment_id: Uuid,
    pub contract_id: String,
    pub status: InstallmentStatus,
    pub read: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}
