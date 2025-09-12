use crate::db;
use crate::model;
use crate::model::ContractStatus;
use anyhow::bail;
use anyhow::Result;
use bitcoin::Amount;
use rust_decimal::Decimal;
use sqlx::PgPool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
struct Installment {
    id: Uuid,
    contract_id: String,
    principal: Decimal,
    interest: Decimal,
    due_date: OffsetDateTime,
    status: InstallmentStatus,
    late_penalty: LatePenalty,
    paid_date: Option<OffsetDateTime>,
    payment_id: Option<String>,
}

#[derive(Debug, Clone, Copy, sqlx::Type)]
#[sqlx(type_name = "installment_status")]
pub enum InstallmentStatus {
    /// The installment has not yet been paid.
    Pending,
    /// The installment has been paid, according to the borrower.
    Paid,
    /// The installment has been paid, as confirmed by the lender.
    Confirmed,
    /// The installment was not paid in time.
    Late,
    /// The installment is no longer expected and was never paid.
    Cancelled,
}

#[derive(Debug, Clone, Copy, sqlx::Type)]
#[sqlx(type_name = "late_penalty")]
enum LatePenalty {
    FullLiquidation,
    InstallmentRestructure,
}

pub async fn insert<'a, E>(db: E, rows: Vec<model::Installment>) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let mut ids: Vec<Uuid> = Vec::with_capacity(rows.len());
    let mut contract_ids: Vec<String> = Vec::with_capacity(rows.len());
    let mut principals: Vec<Decimal> = Vec::with_capacity(rows.len());
    let mut interests: Vec<Decimal> = Vec::with_capacity(rows.len());
    let mut due_dates: Vec<OffsetDateTime> = Vec::with_capacity(rows.len());
    let mut statuses: Vec<InstallmentStatus> = Vec::with_capacity(rows.len());
    let mut late_penalties: Vec<LatePenalty> = Vec::with_capacity(rows.len());

    rows.into_iter().for_each(|row| {
        ids.push(row.id);
        contract_ids.push(row.contract_id.to_string());
        principals.push(row.principal);
        interests.push(row.interest);
        due_dates.push(row.due_date);
        statuses.push(row.status.into());
        late_penalties.push(row.late_penalty.into())
    });

    // We can skip `paid_date` and `payment_id` because installments are created _before_ they are
    // paid.

    sqlx::query!(
        r#"
            INSERT INTO installments (id, contract_id, principal, interest, due_date, status, late_penalty)
            SELECT * FROM UNNEST($1::uuid[], $2::char(36)[], $3::decimal[], $4::decimal[], $5::timestamptz[], $6::installment_status[], $7::late_penalty[])
        "#,
        &ids,
        &contract_ids,
        &principals,
        &interests,
        &due_dates,
        statuses as Vec<InstallmentStatus>,
        late_penalties as Vec<LatePenalty>
    )
    .execute(db)
    .await?;

    Ok(())
}

pub async fn get_by_id(db: &PgPool, id: Uuid) -> Result<Option<model::Installment>> {
    let installment = sqlx::query_as!(
        Installment,
        r#"
            SELECT
                id,
                contract_id,
                principal,
                interest,
                due_date,
                status AS "status: InstallmentStatus",
                late_penalty AS "late_penalty: LatePenalty",
                paid_date,
                payment_id
            FROM installments
            WHERE id = $1
        "#,
        id
    )
    .fetch_optional(db)
    .await?;

    Ok(installment.map(model::Installment::from))
}

pub async fn get_all_for_contract_id(
    db: &PgPool,
    contract_id: &str,
) -> Result<Vec<model::Installment>> {
    let installments = sqlx::query_as!(
        Installment,
        r#"
            SELECT
                id,
                contract_id,
                principal,
                interest,
                due_date,
                status AS "status: InstallmentStatus",
                late_penalty AS "late_penalty: LatePenalty",
                paid_date,
                payment_id
            FROM installments
            WHERE contract_id = $1
        "#,
        contract_id
    )
    .fetch_all(db)
    .await?;

    let installments = installments
        .into_iter()
        .map(model::Installment::from)
        .collect();

    Ok(installments)
}

pub async fn get_all_for_contract_id_with_bitcoin_invoices(
    db: &PgPool,
    contract_id: &str,
) -> Result<Vec<model::InstallmentWithBitcoinInvoice>> {
    // Use LEFT JOIN LATERAL to handle multiple Bitcoin invoices per installment.
    // The LATERAL subquery ensures we get exactly one row per installment by selecting
    // the most relevant invoice using priority: Confirmed > Paid > Pending > newest.
    // This prevents duplicate installment rows that would occur with a simple LEFT JOIN.
    let rows = sqlx::query!(
        r#"
            SELECT
                i.id,
                i.contract_id,
                i.principal,
                i.interest,
                i.due_date,
                i.status AS "status: InstallmentStatus",
                i.late_penalty AS "late_penalty: LatePenalty",
                i.paid_date,
                i.payment_id,
                bi.id AS "invoice_id?",
                bi.amount_sats AS "invoice_amount_sats?",
                bi.status AS "invoice_status?: db::bitcoin_repayment::BitcoinInvoiceStatus"
            FROM installments i
            LEFT JOIN LATERAL (
                SELECT id, amount_sats, status
                FROM btc_invoices
                WHERE installment_id = i.id
                ORDER BY
                    CASE
                        WHEN status = 'Confirmed' THEN 1
                        WHEN status = 'Paid' THEN 2
                        WHEN status = 'Pending' THEN 3
                        ELSE 4
                    END,
                    created_at DESC
                LIMIT 1
            ) bi ON true
            WHERE i.contract_id = $1
            ORDER BY i.due_date
        "#,
        contract_id
    )
    .fetch_all(db)
    .await?;

    let installments = rows
        .into_iter()
        .map(|row| model::InstallmentWithBitcoinInvoice {
            installment: Installment {
                id: row.id,
                contract_id: row.contract_id,
                principal: row.principal,
                interest: row.interest,
                due_date: row.due_date,
                status: row.status,
                late_penalty: row.late_penalty,
                paid_date: row.paid_date,
                payment_id: row.payment_id,
            }
            .into(),
            invoice_id: row.invoice_id,
            invoice_amount_sats: row.invoice_amount_sats.map(|a| Amount::from_sat(a as u64)),
            invoice_status: row.invoice_status.map(|a| a.into()),
        })
        .collect();

    Ok(installments)
}

/// Get all the pending [`Installment`]s which are due in the next 3 days.
pub async fn get_close_to_due_date_installments(db: &PgPool) -> Result<Vec<model::Installment>> {
    let window_start = OffsetDateTime::now_utc();
    let window_end = OffsetDateTime::now_utc() + time::Duration::days(3);

    let statuses = ContractStatus::can_be_checked_for_late_installments_variants()
        .map(model::db::ContractStatus::from)
        .collect::<Vec<_>>();

    let installments = sqlx::query_as!(
        Installment,
        r#"
            SELECT
                installments.id,
                installments.contract_id,
                installments.principal,
                installments.interest,
                installments.due_date,
                installments.status AS "status: InstallmentStatus",
                installments.late_penalty AS "late_penalty: LatePenalty",
                installments.paid_date,
                installments.payment_id
            FROM installments
            JOIN contracts ON installments.contract_id = contracts.id
            WHERE
                installments.status = 'Pending' AND
                installments.due_date > $1 AND
                installments.due_date <= $2 AND
                contracts.status = ANY($3)
        "#,
        window_start,
        window_end,
        &statuses as &[model::db::ContractStatus]
    )
    .fetch_all(db)
    .await?;

    let installments = installments
        .into_iter()
        .map(model::Installment::from)
        .collect();

    Ok(installments)
}

/// Update the status of installments that have not been paid yet.
///
/// # Returns
///
/// The list of [`Installment`]s that were marked as [`InstallmentStatus::Late`].
pub async fn mark_late_installments(db: &PgPool) -> Result<Vec<model::Installment>> {
    let statuses = ContractStatus::can_be_checked_for_late_installments_variants()
        .map(model::db::ContractStatus::from)
        .collect::<Vec<_>>();

    let installments = sqlx::query_as!(
        Installment,
        r#"
            UPDATE installments
                SET status = 'Late'
                FROM contracts
                WHERE installments.contract_id = contracts.id
                  AND installments.due_date < NOW()
                  AND installments.status = 'Pending'
                  AND contracts.status = ANY($1)
            RETURNING
                installments.id,
                installments.contract_id,
                installments.principal,
                installments.interest,
                installments.due_date,
                installments.status AS "status: InstallmentStatus",
                installments.late_penalty AS "late_penalty: LatePenalty",
                installments.paid_date,
                installments.payment_id
        "#,
        &statuses as &[model::db::ContractStatus]
    )
    .fetch_all(db)
    .await?;

    let installments = installments
        .into_iter()
        .map(model::Installment::from)
        .collect();

    Ok(installments)
}

pub async fn load_late_installments_by_contract(
    db: &PgPool,
    contract_id: &str,
) -> Result<Vec<model::Installment>> {
    let installments = sqlx::query_as::<_, Installment>(
        r#"
            SELECT *
            FROM installments
            WHERE contract_id = $1
                AND status = 'Late'
            ORDER BY due_date
        "#,
    )
    .bind(contract_id)
    .fetch_all(db)
    .await?;

    let installments = installments
        .into_iter()
        .map(model::Installment::from)
        .collect();

    Ok(installments)
}

/// The borrower has acknowledged payment.
pub async fn mark_as_paid(db: &PgPool, installment_id: Uuid, payment_id: &str) -> Result<()> {
    let paid_date = OffsetDateTime::now_utc();

    sqlx::query!(
        r#"
            UPDATE installments
            SET
                status = 'Paid',
                payment_id = $1,
                paid_date = $2
            WHERE id = $3
        "#,
        payment_id,
        paid_date,
        installment_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// The lender has confirmed the installment payment.
pub async fn mark_as_confirmed(db: &PgPool, installment_id: Uuid, contract_id: &str) -> Result<()> {
    let rows_affected = sqlx::query!(
        r#"
            UPDATE installments
            SET
                status = 'Confirmed'
            WHERE id = $1 AND status = 'Paid' AND contract_id = $2
        "#,
        installment_id,
        contract_id
    )
    .execute(db)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        bail!("Could not mark installment as confirmed")
    }

    Ok(())
}

/// The installment is no longer expected.
pub async fn mark_as_cancelled<'a, E>(db: E, installment_id: Uuid) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        r#"
            UPDATE installments
            SET status = 'Cancelled'
            WHERE id = $1
        "#,
        installment_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// The lender has confirmed payment.
pub async fn confirm(db: &PgPool, installment_id: Uuid) -> Result<()> {
    sqlx::query!(
        r#"
            UPDATE installments
            SET
                status = 'Confirmed'
            WHERE id = $1
        "#,
        installment_id
    )
    .execute(db)
    .await?;

    Ok(())
}

impl From<Installment> for model::Installment {
    fn from(value: Installment) -> Self {
        Self {
            id: value.id,
            contract_id: value.contract_id.parse().expect("valid UUID"),
            principal: value.principal,
            interest: value.interest,
            due_date: value.due_date,
            status: value.status.into(),
            late_penalty: value.late_penalty.into(),
            paid_date: value.paid_date,
            payment_id: value.payment_id,
        }
    }
}

impl From<LatePenalty> for model::LatePenalty {
    fn from(value: LatePenalty) -> Self {
        match value {
            LatePenalty::FullLiquidation => Self::FullLiquidation,
            LatePenalty::InstallmentRestructure => Self::InstallmentRestructure,
        }
    }
}

impl From<model::LatePenalty> for LatePenalty {
    fn from(value: model::LatePenalty) -> Self {
        match value {
            model::LatePenalty::FullLiquidation => Self::FullLiquidation,
            model::LatePenalty::InstallmentRestructure => Self::InstallmentRestructure,
        }
    }
}

impl From<model::InstallmentStatus> for InstallmentStatus {
    fn from(value: model::InstallmentStatus) -> Self {
        match value {
            model::InstallmentStatus::Pending => Self::Pending,
            model::InstallmentStatus::Paid => Self::Paid,
            model::InstallmentStatus::Confirmed => Self::Confirmed,
            model::InstallmentStatus::Late => Self::Late,
            model::InstallmentStatus::Cancelled => Self::Cancelled,
        }
    }
}

impl From<InstallmentStatus> for model::InstallmentStatus {
    fn from(value: InstallmentStatus) -> Self {
        match value {
            InstallmentStatus::Pending => Self::Pending,
            InstallmentStatus::Paid => Self::Paid,
            InstallmentStatus::Confirmed => Self::Confirmed,
            InstallmentStatus::Late => Self::Late,
            InstallmentStatus::Cancelled => Self::Cancelled,
        }
    }
}
