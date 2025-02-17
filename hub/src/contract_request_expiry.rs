use crate::db;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

/// The number of hours the lender has to accept the borrower's contract request.
const CONTRACT_REQUEST_TIMEOUT: i64 = 24;

/// The number of hours the lender has to accept the borrower's contract request, given that the
/// borrower must first KYC with the lender.
const CONTRACT_REQUEST_KYC_PENDING_TIMEOUT: i64 = 7 * 24;

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

pub async fn add_contract_request_expiry_job(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
) -> Result<()> {
    let database = database.clone();
    let check_for_expiring_contracts_job =
        create_contract_request_expiry_check(scheduler, database).await?;
    let uuid = scheduler.add(check_for_expiring_contracts_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to check if contract requests have expired"
    );

    Ok(())
}

async fn create_contract_request_expiry_check(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_expiring_contracts_job = Job::new_async(
        CHECK_CONTRACT_REQUESTS_EXPIRED_SCHEDULER,
        move |_uuid, _l| {
            tracing::info!("Running job to expire contracts");

            Box::pin({
                let database = database.clone();
                async move {
                    match db::contracts::expire_requested_contracts(
                        &database,
                        CONTRACT_REQUEST_TIMEOUT,
                        CONTRACT_REQUEST_KYC_PENDING_TIMEOUT,
                    )
                    .await
                    {
                        Ok(contracts) => {
                            contracts.iter().for_each(|contract_id| {
                                tracing::info!(contract_id, "Contract request expired");
                            });
                            expire_loan_offers(&database, contracts).await;
                        }
                        Err(err) => {
                            tracing::error!("Failed expire contract requests: {err:#}");
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
                        "Cron job to check if contract requests have expired was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(check_for_expiring_contracts_job)
}

async fn expire_loan_offers(database: &Pool<Postgres>, contracts: Vec<String>) {
    match db::loan_offers::set_loan_offers_unavailable_by_contract_id(
        database,
        contracts.as_slice(),
    )
    .await
    {
        Ok(offer_ids) => {
            offer_ids.iter().for_each(|offer_id| {
                tracing::info!(offer_id, "Loan offer expired due to inactivity");
            });
        }
        Err(error) => {
            tracing::error!("Failed marking loan offer as unavailable: {error:#}");
        }
    }
}
