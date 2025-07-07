use crate::notifications::Notifications;
use anyhow::Result;
use std::sync::Arc;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

// We don't want the doc block below to be auto-formatted.
#[rustfmt::skip]
/// Cron syntax for sending daily digest of loan offers.
///
/// The format is:
/// sec   min   hour   day of month   month   day of week   year
/// *     *     *      *              *       *             *
///
/// Meaning this one runs every day at 9 AM UTC.
const DAILY_DIGEST_SCHEDULER: &str = "0 0 9 * * *";

pub async fn add_daily_digest_job(
    scheduler: &JobScheduler,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let daily_digest_job = create_daily_digest_job(scheduler, notifications).await?;
    let uuid = scheduler.add(daily_digest_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to send daily offer and application digests"
    );

    Ok(())
}

async fn create_daily_digest_job(
    scheduler: &JobScheduler,
    notifications: Arc<Notifications>,
) -> Result<Job, JobSchedulerError> {
    let mut daily_digest_job = Job::new_async(DAILY_DIGEST_SCHEDULER, move |_uuid, _l| {
        tracing::info!("Running daily digest job");

        Box::pin({
            let notifications = notifications.clone();
            async move {
                notifications.send_daily_offer_digest().await;
                notifications.send_daily_application_digest().await;
            }
        })
    })?;

    daily_digest_job
        .on_removed_notification_add(
            scheduler,
            Box::new(|job_id, notification_id, type_of_notification| {
                Box::pin(async move {
                    tracing::error!(
                        job_id = job_id.to_string(),
                        "Daily digest cron job was removed, notification {:?} ran ({:?})",
                        notification_id,
                        type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(daily_digest_job)
}
