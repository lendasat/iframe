use crate::db;
use crate::model::db::ContractStatus;
use anyhow::bail;
use anyhow::Context;
use serde::Deserialize;
use serde::Serialize;
use sqlx::Error;
use sqlx::PgPool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type)]
#[sqlx(
    type_name = "contract_dispute_initiator_type",
    rename_all = "lowercase"
)]
pub enum DisputeInitiatorType {
    Borrower,
    Lender,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "contract_dispute_status")]
pub enum DisputeStatus {
    DisputeStartedBorrower,
    DisputeStartedLender,
    InProgress,
    Closed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type)]
#[sqlx(
    type_name = "contract_dispute_sender_type_enum",
    rename_all = "snake_case"
)]
pub enum SenderType {
    Borrower,
    Lender,
    PlatformAdmin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractDispute {
    pub id: Uuid,
    pub contract_id: String,
    pub initiator_type: DisputeInitiatorType,
    pub initiator_id: String,
    pub status: DisputeStatus,
    pub reason: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339::option")]
    pub resolved_at: Option<OffsetDateTime>,
    pub resolution_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractDisputeMessage {
    pub id: Uuid,
    pub dispute_id: Uuid,
    pub sender_type: SenderType,
    pub sender_id: String,
    pub message: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

// New struct that combines a dispute with its messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeWithMessages {
    #[serde(flatten)]
    pub dispute: ContractDispute,
    pub messages: Vec<ContractDisputeMessage>,
}

pub async fn start_dispute_borrower(
    pool: &PgPool,
    contract_id: &str,
    borrower_id: &str,
    reason: &str,
) -> Result<ContractDispute, anyhow::Error> {
    let mut transaction = pool.begin().await?;

    let dispute = create_dispute(
        &mut transaction,
        contract_id,
        borrower_id,
        reason,
        DisputeInitiatorType::Borrower,
        DisputeStatus::DisputeStartedBorrower,
    )
    .await?;

    db::contracts::mark_contract_state_as(
        &mut *transaction,
        contract_id,
        ContractStatus::DisputeBorrowerStarted,
    )
    .await
    .context("Failed marking contract as dispute started.")?;

    transaction.commit().await?;

    Ok(dispute)
}
pub async fn start_dispute_lender(
    pool: &PgPool,
    contract_id: &str,
    lender_id: &str,
    reason: &str,
) -> Result<ContractDispute, anyhow::Error> {
    let mut transaction = pool.begin().await?;

    let dispute = create_dispute(
        &mut transaction,
        contract_id,
        lender_id,
        reason,
        DisputeInitiatorType::Lender,
        DisputeStatus::DisputeStartedLender,
    )
    .await?;

    db::contracts::mark_contract_state_as(
        &mut *transaction,
        contract_id,
        ContractStatus::DisputeLenderStarted,
    )
    .await
    .context("Failed marking contract as dispute started.")?;

    transaction.commit().await?;

    Ok(dispute)
}

/// Create a new dispute initiated by a lender
pub async fn create_lender_dispute(
    pool: &PgPool,
    contract_id: &str,
    lender_id: &str,
    reason: &str,
) -> Result<ContractDispute, anyhow::Error> {
    let mut transaction = pool.begin().await?;

    let dispute = create_dispute(
        &mut transaction,
        contract_id,
        lender_id,
        reason,
        DisputeInitiatorType::Lender,
        DisputeStatus::DisputeStartedLender,
    )
    .await?;

    db::contracts::mark_contract_state_as(
        &mut *transaction,
        contract_id,
        ContractStatus::DisputeLenderStarted,
    )
    .await
    .context("Failed marking contract as dispute started.")?;

    transaction.commit().await?;

    Ok(dispute)
}

/// Create a new dispute
async fn create_dispute(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    contract_id: &str,
    initiator: &str,
    reason: &str,
    dispute_initiator_type: DisputeInitiatorType,
    dispute_status: DisputeStatus,
) -> Result<ContractDispute, Error> {
    let id = Uuid::new_v4();
    sqlx::query_as!(
        ContractDispute,
        r#"
            INSERT INTO contract_disputes 
                (id, contract_id, initiator_type, initiator_id, status, reason)
            VALUES 
                ($1, $2, $3, $4, $5, $6)
            RETURNING 
                id, 
                contract_id, 
                initiator_type as "initiator_type: DisputeInitiatorType", 
                initiator_id, 
                status as "status: DisputeStatus", 
                reason, 
                created_at, 
                updated_at, 
                resolved_at, 
                resolution_notes
            "#,
        id,
        contract_id.to_string(),
        dispute_initiator_type as DisputeInitiatorType,
        initiator,
        dispute_status as DisputeStatus,
        reason
    )
    .fetch_one(&mut **transaction)
    .await
}

/// Add a message to an existing dispute from a borrower
pub async fn add_borrower_message(
    pool: &PgPool,
    dispute_id: Uuid,
    borrower_id: String,
    message: String,
) -> Result<ContractDisputeMessage, Error> {
    add_message(pool, dispute_id, SenderType::Borrower, borrower_id, message).await
}

/// Add a message to an existing dispute from a lender
pub async fn add_lender_message(
    pool: &PgPool,
    dispute_id: Uuid,
    lender_id: String,
    message: String,
) -> Result<ContractDisputeMessage, Error> {
    add_message(pool, dispute_id, SenderType::Lender, lender_id, message).await
}

async fn add_message(
    pool: &PgPool,
    dispute_id: Uuid,
    sender_type: SenderType,
    sender_id: String,
    message: String,
) -> Result<ContractDisputeMessage, Error> {
    let id = Uuid::new_v4();
    sqlx::query_as!(
        ContractDisputeMessage,
        r#"
            INSERT INTO contract_dispute_messages 
                (id, dispute_id, sender_type, sender_id, message)
            VALUES 
                ($1, $2, $3, $4, $5)
            RETURNING 
                id, 
                dispute_id, 
                sender_type as "sender_type: SenderType", 
                sender_id, 
                message, 
                created_at 
            "#,
        id,
        dispute_id,
        sender_type as SenderType,
        sender_id,
        message
    )
    .fetch_one(pool)
    .await
}

/// Get a dispute by contract ID
pub async fn get_disputes_by_contract(
    pool: &PgPool,
    contract_id: &str,
) -> Result<Vec<ContractDispute>, Error> {
    sqlx::query_as!(
        ContractDispute,
        r#"
            SELECT
                id, 
                contract_id, 
                initiator_type as "initiator_type: DisputeInitiatorType", 
                initiator_id, 
                status as "status: DisputeStatus", 
                reason, 
                created_at, 
                updated_at, 
                resolved_at, 
                resolution_notes
            FROM contract_disputes
                where contract_id = $1
            ORDER BY created_at DESC
            "#,
        contract_id.to_string(),
    )
    .fetch_all(pool)
    .await
}

/// Get a dispute by dispute ID
pub async fn get_dispute_by_dispute_id(
    pool: &PgPool,
    dispute_id: Uuid,
) -> Result<ContractDispute, Error> {
    sqlx::query_as!(
        ContractDispute,
        r#"
            SELECT
                id,
                contract_id,
                initiator_type as "initiator_type: DisputeInitiatorType",
                initiator_id,
                status as "status: DisputeStatus",
                reason,
                created_at,
                updated_at,
                resolved_at,
                resolution_notes
            FROM contract_disputes
            WHERE
                id = $1
            "#,
        dispute_id
    )
    .fetch_one(pool)
    .await
}

/// Get all messages for a specific dispute
pub async fn get_dispute_messages(
    pool: &PgPool,
    dispute_id: Uuid,
) -> Result<Vec<ContractDisputeMessage>, Error> {
    sqlx::query_as!(
        ContractDisputeMessage,
        r#"
            SELECT
                id, 
                dispute_id, 
                sender_type as "sender_type: SenderType", 
                sender_id, 
                message, 
                created_at
            FROM contract_dispute_messages
            WHERE dispute_id = $1
            ORDER BY created_at ASC
            "#,
        dispute_id
    )
    .fetch_all(pool)
    .await
}

/// Get a dispute with all its messages by contract ID
pub async fn get_disputes_with_messages_by_contract(
    pool: &PgPool,
    contract_id: &str,
) -> Result<Vec<DisputeWithMessages>, Error> {
    let disputes = get_disputes_by_contract(pool, contract_id).await?;

    if disputes.is_empty() {
        return Ok(vec![]);
    }

    let mut res = vec![];

    for dispute in disputes {
        let messages = get_dispute_messages(pool, dispute.id).await?;
        res.push(DisputeWithMessages { dispute, messages });
    }

    Ok(res)
}

pub async fn resolve_borrower(
    pool: &PgPool,
    dispute_id: Uuid,
    borrower_id: &str,
) -> anyhow::Result<()> {
    let dispute = get_dispute_by_dispute_id(pool, dispute_id).await?;
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        pool,
        dispute.contract_id.as_str(),
        borrower_id,
    )
    .await?;
    let mut transaction = pool.begin().await?;

    update_dispute(
        &mut transaction,
        dispute_id,
        borrower_id,
        DisputeStatus::Closed,
    )
    .await?;

    db::contracts::resolve_dispute(&mut transaction, &contract)
        .await
        .context("Failed rolling back contract status.")?;

    transaction.commit().await?;

    Ok(())
}

pub async fn resolve_lender(
    pool: &PgPool,
    dispute_id: Uuid,
    lender_id: &str,
) -> anyhow::Result<()> {
    let dispute = get_dispute_by_dispute_id(pool, dispute_id).await?;
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        pool,
        dispute.contract_id.as_str(),
        lender_id,
    )
    .await?
    .context("contract not found")?;
    let mut transaction = pool.begin().await?;

    update_dispute(
        &mut transaction,
        dispute_id,
        lender_id,
        DisputeStatus::Closed,
    )
    .await?;

    db::contracts::resolve_dispute(&mut transaction, &contract)
        .await
        .context("Failed rolling back contract status.")?;

    transaction.commit().await?;

    Ok(())
}

/// Updates status of a dispute
async fn update_dispute(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    dispute_id: Uuid,
    initiator: &str,
    dispute_status: DisputeStatus,
) -> anyhow::Result<()> {
    let rows_affected = sqlx::query!(
        r#"
            UPDATE contract_disputes 
                set status = $1
            where 
                id = $2 and initiator_id = $3
            "#,
        dispute_status as DisputeStatus,
        dispute_id,
        initiator
    )
    .execute(&mut **transaction)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        bail!("Could not update dispute status.")
    }

    Ok(())
}
