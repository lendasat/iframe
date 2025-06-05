use crate::model::ContractStatus;
use crate::model::InstallmentStatus;
use serde::Deserialize;
use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
