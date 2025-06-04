use crate::db::installments::InstallmentStatus;
use crate::db::notifications::ContractChatMessageNotification;
use crate::db::notifications::ContractUpdateNotification;
use crate::db::notifications::InstallmentUpdateNotification;
use crate::model;
use crate::model::db::ContractStatus;
use sqlx::PgPool;
use sqlx::Result;
use uuid::Uuid;

// Insert a new notification
pub async fn insert_contract_update_notification(
    pool: &PgPool,
    contract_id: &str,
    status: ContractStatus,
) -> Result<ContractUpdateNotification, sqlx::Error> {
    let notification = sqlx::query_as!(
        ContractUpdateNotification,
        r#"
        INSERT INTO lender_contract_update_notifications (contract_id, status, read)
        VALUES ($1, $2, $3)
        RETURNING id, contract_id, status as "status: ContractStatus", read, created_at, updated_at
        "#,
        contract_id,
        status as ContractStatus,
        false
    )
    .fetch_one(pool)
    .await?;

    Ok(notification)
}
// Update notification as read and update the updated_at timestamp
pub async fn mark_as_read(pool: &PgPool, notification_id: Uuid) -> Result<(), sqlx::Error> {
    mark_contract_notification_as_read(pool, notification_id).await?;
    mark_installment_notification_as_read(pool, notification_id).await?;
    mark_chat_message_notification_as_read(pool, notification_id).await?;

    Ok(())
}
// Update notification as read and update the updated_at timestamp
pub async fn mark_contract_notification_as_read(
    pool: &PgPool,
    notification_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE lender_contract_update_notifications 
        SET read = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        "#,
        notification_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_installment_notification_as_read(
    pool: &PgPool,
    notification_id: Uuid,
) -> std::result::Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE lender_installment_update_notifications
        SET read = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        "#,
        notification_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Get all notifications by lender_id (joining with contracts table)
pub async fn get_contract_notifications_by_lender_id(
    pool: &PgPool,
    lender_id: &str,
) -> Result<Vec<ContractUpdateNotification>, sqlx::Error> {
    let notifications = sqlx::query_as!(
        ContractUpdateNotification,
        r#"
        SELECT 
            n.id,
            n.contract_id,
            n.status as "status: ContractStatus",
            n.read,
            n.created_at,
            n.updated_at
        FROM lender_contract_update_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        WHERE c.lender_id = $1
        ORDER BY n.created_at DESC
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    Ok(notifications)
}

pub async fn mark_all_as_read(pool: &PgPool, lender_id: &str) -> Result<u64, sqlx::Error> {
    let contract_rows_changed = mark_all_contract_notifications_as_read(pool, lender_id).await?;
    let chat_rows_changed =
        mark_all_chat_message_notifications_as_read_by_lender_id(pool, lender_id).await?;
    let installment_rows_changed =
        mark_all_installment_notifications_as_read(pool, lender_id).await?;

    Ok(contract_rows_changed + installment_rows_changed + chat_rows_changed)
}

pub async fn mark_all_contract_notifications_as_read(
    pool: &PgPool,
    lender_id: &str,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE lender_contract_update_notifications 
        SET read = true, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (
            SELECT n.id 
            FROM lender_contract_update_notifications n
            INNER JOIN contracts c ON n.contract_id = c.id
            WHERE c.lender_id = $1 AND n.read = false
        )
        "#,
        lender_id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

pub async fn mark_all_installment_notifications_as_read(
    pool: &PgPool,
    lender_id: &str,
) -> std::result::Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE lender_installment_update_notifications
        SET read = true, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (
            SELECT n.id
            FROM lender_installment_update_notifications n
            INNER JOIN contracts c ON n.contract_id = c.id
            WHERE c.lender_id = $1 AND n.read = false
        )
        "#,
        lender_id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

// Insert a new chat message notification
pub async fn insert_chat_message_notification(
    pool: &PgPool,
    contract_id: &str,
) -> Result<ContractChatMessageNotification, sqlx::Error> {
    let notification = sqlx::query_as!(
        ContractChatMessageNotification,
        r#"
        INSERT INTO lender_contract_chat_message_notifications (contract_id, read)
        VALUES ($1, $2)
        RETURNING 
            id, 
            contract_id, 
            read, 
            created_at, 
            updated_at,
            (SELECT b.name FROM contracts c 
             INNER JOIN borrowers b ON c.borrower_id = b.id 
             WHERE c.id = contract_id) as "borrower_name!"
        "#,
        contract_id,
        false
    )
    .fetch_one(pool)
    .await?;

    Ok(notification)
}

pub async fn count_contract_notifications_by_lender_id(
    pool: &PgPool,
    lender_id: &str,
    unread_only: bool,
) -> Result<u64, sqlx::Error> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as count
        FROM lender_contract_update_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        WHERE c.lender_id = $1 
        AND ($2 = false OR n.read = false)
        "#,
        lender_id,
        unread_only
    )
    .fetch_one(pool)
    .await?;

    Ok(count.unwrap_or(0) as u64)
}

// Get paginated contract notifications
pub async fn get_contract_notifications_by_lender_id_paginated(
    pool: &PgPool,
    lender_id: &str,
    limit: u32,
    offset: u32,
    unread_only: bool,
) -> Result<Vec<ContractUpdateNotification>, sqlx::Error> {
    let notifications = sqlx::query_as!(
        ContractUpdateNotification,
        r#"
        SELECT 
            n.id,
            n.contract_id,
            n.status as "status: ContractStatus",
            n.read,
            n.created_at,
            n.updated_at
        FROM lender_contract_update_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        WHERE c.lender_id = $1 
        AND ($2 = false OR n.read = false)
        ORDER BY n.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
        lender_id,
        unread_only,
        limit as i64,
        offset as i64
    )
    .fetch_all(pool)
    .await?;

    Ok(notifications)
}

// Get all chat message notifications by lender_id
pub async fn get_chat_message_notifications_by_lender_id(
    pool: &PgPool,
    lender_id: &str,
) -> Result<Vec<ContractChatMessageNotification>, sqlx::Error> {
    let notifications = sqlx::query_as!(
        ContractChatMessageNotification,
        r#"
        SELECT 
            n.id,
            n.contract_id,
            n.read,
            n.created_at,
            n.updated_at,
            b.name as "borrower_name!"
        FROM lender_contract_chat_message_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        INNER JOIN borrowers b ON c.borrower_id = b.id
        WHERE c.lender_id = $1
        ORDER BY n.created_at DESC
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    Ok(notifications)
}

// Count chat message notifications
pub async fn count_chat_message_notifications_by_lender_id(
    pool: &PgPool,
    lender_id: &str,
    unread_only: bool,
) -> Result<u64, sqlx::Error> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as count
        FROM lender_contract_chat_message_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        WHERE c.lender_id = $1 
        AND ($2 = false OR n.read = false)
        "#,
        lender_id,
        unread_only
    )
    .fetch_one(pool)
    .await?;

    Ok(count.unwrap_or(0) as u64)
}

pub async fn count_installment_notifications_by_lender_id(
    pool: &PgPool,
    lender_id: &str,
    unread_only: bool,
) -> std::result::Result<u64, sqlx::Error> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as count
        FROM lender_installment_update_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        WHERE c.lender_id = $1
        AND ($2 = false OR n.read = false)
        "#,
        lender_id,
        unread_only
    )
    .fetch_one(pool)
    .await?;

    Ok(count.unwrap_or(0) as u64)
}

// Get paginated chat message notifications
pub async fn get_chat_message_notifications_by_lender_id_paginated(
    pool: &PgPool,
    lender_id: &str,
    limit: u32,
    offset: u32,
    unread_only: bool,
) -> Result<Vec<ContractChatMessageNotification>, sqlx::Error> {
    let notifications = sqlx::query_as!(
        ContractChatMessageNotification,
        r#"
        SELECT 
            n.id,
            n.contract_id,
            n.read,
            n.created_at,
            n.updated_at,
            b.name as "borrower_name!"
        FROM lender_contract_chat_message_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        INNER JOIN borrowers b ON c.borrower_id = b.id
        WHERE c.lender_id = $1 
        AND ($2 = false OR n.read = false)
        ORDER BY n.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
        lender_id,
        unread_only,
        limit as i64,
        offset as i64
    )
    .fetch_all(pool)
    .await?;

    Ok(notifications)
}

pub async fn get_installment_notifications_by_lender_id_paginated(
    pool: &PgPool,
    lender_id: &str,
    limit: u32,
    offset: u32,
    unread_only: bool,
) -> std::result::Result<Vec<InstallmentUpdateNotification>, sqlx::Error> {
    let notifications = sqlx::query_as!(
        InstallmentUpdateNotification,
        r#"
        SELECT
            n.id,
            n.installment_id,
            n.contract_id,
            n.status as "status: InstallmentStatus",
            n.read,
            n.created_at,
            n.updated_at
        FROM lender_installment_update_notifications n
        INNER JOIN contracts c ON n.contract_id = c.id
        WHERE c.lender_id = $1
        AND ($2 = false OR n.read = false)
        ORDER BY n.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
        lender_id,
        unread_only,
        limit as i64,
        offset as i64
    )
    .fetch_all(pool)
    .await?;

    Ok(notifications)
}

// Mark a specific chat message notification as read
pub async fn mark_chat_message_notification_as_read(
    pool: &PgPool,
    notification_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE lender_contract_chat_message_notifications 
        SET read = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        "#,
        notification_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Mark all chat message notifications as read for a specific lender
pub async fn mark_all_chat_message_notifications_as_read_by_lender_id(
    pool: &PgPool,
    lender_id: &str,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE lender_contract_chat_message_notifications 
        SET read = true, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (
            SELECT n.id 
            FROM lender_contract_chat_message_notifications n
            INNER JOIN contracts c ON n.contract_id = c.id
            WHERE c.lender_id = $1 AND n.read = false
        )
        "#,
        lender_id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

pub async fn insert_installment_update_notification(
    pool: &PgPool,
    installment_id: Uuid,
    contract_id: &str,
    status: model::InstallmentStatus,
) -> std::result::Result<InstallmentUpdateNotification, sqlx::Error> {
    let status = InstallmentStatus::from(status);

    let notification = sqlx::query_as!(
        InstallmentUpdateNotification,
        r#"
        INSERT INTO lender_installment_update_notifications (installment_id, contract_id, status, read)
        VALUES ($1, $2, $3, $4)
        RETURNING id, installment_id, contract_id, status as "status: InstallmentStatus", read, created_at, updated_at
        "#,
        installment_id,
        contract_id,
        status as InstallmentStatus,
        false
    )
        .fetch_one(pool)
        .await?;

    Ok(notification)
}
