use crate::db;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

// We don't want the doc block below to be auto-formatted.
#[rustfmt::skip]
/// Cron syntax for marking installments as late.
///
/// The format is:
/// sec   min   hour   day of month   month   day of week   year
/// *     *     *      *              *       *             *
///
/// Meaning this one runs every 30 minutes.
const CHECK_LATE_INSTALLMENT_SCHEDULER: &str = "0 0/30 * * * *";

pub async fn add_late_installment_job(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
) -> Result<()> {
    let database = database.clone();

    tracing::info!("Running late installment job immediately on startup");
    run_late_installment_check(&database).await;

    let check_for_late_installments_job =
        create_late_installment_check(scheduler, database).await?;
    let uuid = scheduler.add(check_for_late_installments_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to mark installments as late"
    );

    Ok(())
}

async fn run_late_installment_check(db: &Pool<Postgres>) {
    tracing::info!("Running late installment check");

    match db::installments::mark_late_installments(db).await {
        Ok(late_installments) => {
            tracing::info!(
                count = late_installments.len(),
                "Marked installments as late"
            );
        }
        Err(e) => {
            tracing::error!("Failed to mark installments as late: {e:#}");
        }
    };
}

async fn create_late_installment_check(
    scheduler: &JobScheduler,
    db: Pool<Postgres>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_late_installments_job =
        Job::new_async(CHECK_LATE_INSTALLMENT_SCHEDULER, move |_uuid, _l| {
            Box::pin({
                let db = db.clone();
                async move {
                    run_late_installment_check(&db).await;
                }
            })
        })?;

    check_for_late_installments_job
        .on_removed_notification_add(
            scheduler,
            Box::new(|job_id, notification_id, type_of_notification| {
                Box::pin(async move {
                    tracing::error!(
                        job_id = job_id.to_string(),
                        "Cron job to mark installments as late was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(check_for_late_installments_job)
}

