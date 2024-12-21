use crate::db;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

// We don't want the doc block below to be auto-formatted.
#[rustfmt::skip]
/// Cron syntax for defaulting expired contracts.
///
/// The format is:
/// sec   min   hour   day of month   month   day of week   year
/// *     *     *      *              *       *             *
///
/// Meaning this one runs every 30 minutes.
const CHECK_CONTRACT_DEFAULT_SCHEDULER: &str = "0 0/30 * * * *";

pub async fn add_contract_default_job(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
) -> Result<()> {
    let database = database.clone();
    let check_for_expiring_contracts_job =
        create_contract_expiry_check(scheduler, database).await?;
    let uuid = scheduler.add(check_for_expiring_contracts_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to default expired contracts"
    );

    Ok(())
}

async fn create_contract_expiry_check(
    scheduler: &JobScheduler,
    db: Pool<Postgres>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_expiring_contracts_job =
        Job::new_async(CHECK_CONTRACT_DEFAULT_SCHEDULER, move |_uuid, _l| {
            tracing::info!("Running job");

            Box::pin({
                let db = db.clone();
                async move {
                    match db::contracts::default_expired_contracts(&db).await {
                        Ok(contracts) => contracts.iter().for_each(|contract_id| {
                            tracing::info!(contract_id, "Contract defaulted");
                        }),
                        Err(e) => {
                            tracing::error!("Failed to default expired contracts: {e:#}");
                        }
                    }
                }
            })
        })?;

    check_for_expiring_contracts_job
        .on_removed_notification_add(
            scheduler,
            Box::new(|job_id, notification_id, type_of_notification| {
                Box::pin(async move {
                    tracing::error!(
                        job_id = job_id.to_string(),
                        "Cron job to default expired contracts was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(check_for_expiring_contracts_job)
}
