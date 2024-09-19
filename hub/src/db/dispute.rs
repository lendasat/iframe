use crate::db;
use crate::model::db::ContractStatus;
use crate::model::Dispute;
use anyhow::Context;
use anyhow::Result;
use sqlx::Error;
use sqlx::PgPool;
use sqlx::Pool;
use sqlx::Postgres;
use uuid::Uuid;

/// Inserts a new dispute event into the db and sets the contract status to DisputeBorrowerStarted
///
/// If `dispute_already_started` is true, the contract status will not be changed
pub async fn start_new_dispute_borrower(
    pool: &PgPool,
    contract_id: &str,
    borrower_id: &str,
    lender_id: &str,
    comment: &str,
    dispute_already_started: bool,
) -> Result<Dispute> {
    let mut transaction = pool.begin().await?;

    let dispute = insert_new_dispute(
        &mut transaction,
        contract_id,
        borrower_id,
        lender_id,
        comment,
        crate::model::DisputeStatus::StartedBorrower,
    )
    .await
    .context("Failed inserting new dispute.")?;

    if !dispute_already_started {
        db::contracts::mark_contract_as(
            &mut transaction,
            contract_id,
            ContractStatus::DisputeBorrowerStarted,
        )
        .await
        .context("Failed marking contract as dispute started.")?;
    }

    transaction.commit().await?;

    Ok(dispute)
}

/// Inserts a new dispute event into the db and sets the contract status to DisputeLenderStarted
///
/// If `dispute_already_started` is true, the contract status will not be changed
pub async fn start_new_dispute_lender(
    pool: &PgPool,
    contract_id: &str,
    borrower_id: &str,
    lender_id: &str,
    comment: &str,
    dispute_already_started: bool,
) -> Result<Dispute> {
    let mut transaction = pool.begin().await?;

    let dispute = insert_new_dispute(
        &mut transaction,
        contract_id,
        borrower_id,
        lender_id,
        comment,
        crate::model::DisputeStatus::StartedLender,
    )
    .await
    .context("Failed inserting new dispute.")?;

    if !dispute_already_started {
        db::contracts::mark_contract_as(
            &mut transaction,
            contract_id,
            ContractStatus::DisputeLenderStarted,
        )
        .await
        .context("Failed marking contract as dispute started.")?;
    }

    transaction.commit().await?;

    Ok(dispute)
}

async fn insert_new_dispute(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    contract_id: &str,
    borrower_id: &str,
    lender_id: &str,
    comment: &str,
    status: crate::model::DisputeStatus,
) -> Result<Dispute> {
    let id = Uuid::new_v4().to_string();
    let dispute = sqlx::query_as!(
        Dispute,
        r#"
        INSERT INTO DISPUTES (
            id,
            contract_id,
            borrower_id,
            lender_id,
            comment,
            status
        )
        VALUES(   
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
        )
        RETURNING 
            id,
            contract_id, 
            borrower_id, 
            lender_id, 
            comment, 
            lender_payout_sats,
            borrower_payout_sats,
            status as "status: crate::model::DisputeStatus",
            created_at,
            updated_at
        "#,
        id,
        contract_id,
        borrower_id,
        lender_id,
        comment,
        status as crate::model::DisputeStatus
    )
    .fetch_one(&mut **transaction)
    .await?;
    Ok(dispute)
}

pub(crate) async fn load_disputes_by_borrower_and_dispute_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    dispute_id: &str,
) -> Result<Option<Dispute>, Error> {
    let disputes = sqlx::query_as!(
        Dispute,
        r#"
        SELECT 
            id,
            contract_id,
            borrower_id,
            lender_id,
            lender_payout_sats,
            borrower_payout_sats,
            comment,
            status as "status: crate::model::DisputeStatus",
            created_at,
            updated_at
        FROM 
            DISPUTES
        WHERE 
            id = $1 and borrower_id = $2
        "#,
        dispute_id,
        borrower_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(disputes)
}

pub(crate) async fn load_disputes_by_borrower_and_contract_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    contract_id: &str,
) -> Result<Vec<Dispute>, Error> {
    let disputes = sqlx::query_as!(
        Dispute,
        r#"
        SELECT 
            id,
            contract_id,
            borrower_id,
            lender_id,
            lender_payout_sats,
            borrower_payout_sats,
            comment,
            status as "status: crate::model::DisputeStatus",
            created_at,
            updated_at
        FROM 
            DISPUTES
        WHERE 
            contract_id = $1 and borrower_id = $2
        "#,
        contract_id,
        borrower_id
    )
    .fetch_all(pool)
    .await?;

    Ok(disputes)
}

pub(crate) async fn load_disputes_by_lender(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<Vec<Dispute>, Error> {
    let disputes = sqlx::query_as!(
        Dispute,
        r#"
        SELECT 
            id,
            contract_id,
            borrower_id,
            lender_id,
            lender_payout_sats,
            borrower_payout_sats,
            comment,
            status as "status: crate::model::DisputeStatus",
            created_at,
            updated_at
        FROM 
            DISPUTES
        WHERE 
            lender_id = $1
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    Ok(disputes)
}

pub(crate) async fn load_disputes_by_borrower(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<Vec<Dispute>, Error> {
    let disputes = sqlx::query_as!(
        Dispute,
        r#"
        SELECT 
            id,
            contract_id,
            borrower_id,
            lender_id,
            lender_payout_sats,
            borrower_payout_sats,
            comment,
            status as "status: crate::model::DisputeStatus",
            created_at,
            updated_at
        FROM 
            DISPUTES
        WHERE 
            borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_all(pool)
    .await?;

    Ok(disputes)
}

pub(crate) async fn load_disputes_by_lender_and_dispute_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
    dispute_id: &str,
) -> Result<Option<Dispute>, Error> {
    let disputes = sqlx::query_as!(
        Dispute,
        r#"
        SELECT 
            id,
            contract_id,
            borrower_id,
            lender_id,
            lender_payout_sats,
            borrower_payout_sats,
            comment,
            status as "status: crate::model::DisputeStatus",
            created_at,
            updated_at
        FROM 
            DISPUTES
        WHERE 
            id = $1 and lender_id = $2
        "#,
        dispute_id,
        lender_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(disputes)
}

pub(crate) async fn load_disputes_by_lender_and_contract_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
    contract_id: &str,
) -> Result<Vec<Dispute>, Error> {
    let dispute = sqlx::query_as!(
        Dispute,
        r#"
        SELECT 
            id,
            contract_id,
            borrower_id,
            lender_id,
            lender_payout_sats,
            borrower_payout_sats,
            comment,
            status as "status: crate::model::DisputeStatus",
            created_at,
            updated_at
        FROM 
            DISPUTES
        WHERE 
            contract_id = $1 and lender_id = $2
        "#,
        contract_id,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    Ok(dispute)
}
