use crate::model::ContractStatus;
use crate::model::InstallmentStatus;
use serde::Deserialize;
use serde::Serialize;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", content = "data")]
pub enum NotificationMessage {
    ContractUpdate {
        id: Uuid,
        contract_id: String,
        #[serde(with = "time::serde::rfc3339")]
        timestamp: OffsetDateTime,
        status: ContractStatus,
        read: bool,
    },
    InstallmentUpdate {
        id: Uuid,
        installment_id: Uuid,
        contract_id: String,
        #[serde(with = "time::serde::rfc3339")]
        timestamp: OffsetDateTime,
        status: InstallmentStatus,
        read: bool,
    },
    ChatMessage {
        id: Uuid,
        contract_id: String,
        borrower_name: String,
        #[serde(with = "time::serde::rfc3339")]
        timestamp: OffsetDateTime,
        read: bool,
    },
}

impl NotificationMessage {
    pub fn timestamp(&self) -> OffsetDateTime {
        match self {
            NotificationMessage::ContractUpdate { timestamp, .. } => *timestamp,
            NotificationMessage::InstallmentUpdate { timestamp, .. } => *timestamp,
            NotificationMessage::ChatMessage { timestamp, .. } => *timestamp,
        }
    }
}

impl From<crate::db::notifications::ContractUpdateNotification> for NotificationMessage {
    fn from(value: crate::db::notifications::ContractUpdateNotification) -> Self {
        NotificationMessage::ContractUpdate {
            id: value.id,
            contract_id: value.contract_id,
            timestamp: value.created_at,
            status: value.status.into(),
            read: value.read,
        }
    }
}

impl From<crate::db::notifications::InstallmentUpdateNotification> for NotificationMessage {
    fn from(value: crate::db::notifications::InstallmentUpdateNotification) -> Self {
        NotificationMessage::InstallmentUpdate {
            id: value.id,
            installment_id: value.installment_id,
            contract_id: value.contract_id,
            timestamp: value.created_at,
            status: value.status.into(),
            read: value.read,
        }
    }
}

impl From<crate::db::notifications::ContractChatMessageNotification> for NotificationMessage {
    fn from(value: crate::db::notifications::ContractChatMessageNotification) -> Self {
        NotificationMessage::ChatMessage {
            id: value.id,
            contract_id: value.contract_id,
            borrower_name: value.counterparty_name,
            timestamp: value.created_at,
            read: value.read,
        }
    }
}

#[derive(Debug, Clone)]
pub struct LenderNotificationSettings {
    pub lender_id: String,
    pub on_login_email: bool,
    pub on_login_telegram: bool,
    pub daily_application_digest_email: bool,
    pub new_loan_applications_telegram: bool,
    pub contract_status_changed_email: bool,
    pub contract_status_changed_telegram: bool,
    pub new_chat_message_email: bool,
    pub new_chat_message_telegram: bool,
}

impl LenderNotificationSettings {
    pub fn new(lender_id: String) -> Self {
        Self {
            lender_id,
            on_login_email: true,
            on_login_telegram: true,
            daily_application_digest_email: true,
            new_loan_applications_telegram: true,
            contract_status_changed_email: true,
            contract_status_changed_telegram: true,
            new_chat_message_email: true,
            new_chat_message_telegram: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BorrowerNotificationSettings {
    pub borrower_id: String,
    pub on_login_email: bool,
    pub on_login_telegram: bool,
    pub daily_offer_digest_email: bool,
    pub new_loan_offer_telegram: bool,
    pub contract_status_changed_email: bool,
    pub contract_status_changed_telegram: bool,
    pub new_chat_message_email: bool,
    pub new_chat_message_telegram: bool,
}

impl BorrowerNotificationSettings {
    pub fn new(borrower_id: String) -> Self {
        Self {
            borrower_id,
            on_login_email: true,
            on_login_telegram: true,
            daily_offer_digest_email: true,
            new_loan_offer_telegram: true,
            contract_status_changed_email: true,
            contract_status_changed_telegram: true,
            new_chat_message_email: true,
            new_chat_message_telegram: true,
        }
    }
}
