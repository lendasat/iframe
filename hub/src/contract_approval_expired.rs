use crate::db;
use crate::db::contracts::ExpiredApprovedContract;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

/// The number of hours the borrower has to fund an approved contract request.
const CONTRACT_APPROVAL_TIMEOUT: i64 = 24;

// We don't want the doc block below to be auto-formatted.
#[rustfmt::skip]
/// Cron syntax for checking if contract requests have expired.
///
/// The format is:
/// sec   min   hour   day of month   month   day of week   year
/// *     *     *      *              *       *             *
///
/// Meaning this one runs every 30 minutes.
const CHECK_CONTRACT_REQUESTS_EXPIRED_SCHEDULER: &str = "0 0/30 * * * *";

pub async fn add_contract_approval_expiry_job(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
) -> Result<()> {
    let database = database.clone();
    let check_for_expiring_contracts_job =
        create_contract_approval_expiry_check(scheduler, database).await?;
    let uuid = scheduler.add(check_for_expiring_contracts_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to check if contract approvals have expired"
    );

    Ok(())
}

async fn create_contract_approval_expiry_check(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_expiring_contracts_job = Job::new_async(
        CHECK_CONTRACT_REQUESTS_EXPIRED_SCHEDULER,
        move |_uuid, _l| {
            tracing::info!("Running job to expire approved contracts");

            Box::pin({
                let database = database.clone();
                async move {
                    match db::contracts::expire_approved_contracts(
                        &database,
                        CONTRACT_APPROVAL_TIMEOUT,
                    )
                    .await
                    {
                        Ok(contracts) => {
                            for contract in contracts {
                                tracing::info!(
                                    contract_id = contract.contract_id,
                                    "Contract approval expired"
                                );
                                restore_loan_amount_for_expired_contract(&database, &contract)
                                    .await;
                            }
                        }
                        Err(err) => {
                            tracing::error!("Failed expire contract approval: {err:#}");
                        }
                    }
                }
            })
        },
    )?;

    check_for_expiring_contracts_job
        .on_removed_notification_add(
            scheduler,
            Box::new(|job_id, notification_id, type_of_notification| {
                Box::pin(async move {
                    tracing::error!(
                        job_id = job_id.to_string(),
                        "Cron job to check if contract approval have expired was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(check_for_expiring_contracts_job)
}

async fn restore_loan_amount_for_expired_contract(
    database: &Pool<Postgres>,
    expired_contract: &ExpiredApprovedContract,
) {
    if let Err(e) = db::loan_offers::increase_loan_amount_max(
        database,
        &expired_contract.loan_deal_id,
        expired_contract.loan_amount,
    )
    .await
    {
        tracing::error!(
            "Failed to restore loan_amount_max for offer {} after contract expiry: {e:#}",
            expired_contract.loan_deal_id
        );
    }
    tracing::debug!(
        contract_id = expired_contract.contract_id,
        offer_id = expired_contract.loan_deal_id,
        restored_amount = %expired_contract.loan_amount,
        "Restored loan_amount_max for expired contract request"
    );
}
