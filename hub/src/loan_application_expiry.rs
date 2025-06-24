use crate::config::Config;
use crate::db;
use crate::db::loan_applications::ExpiredApplication;
use crate::notifications::Notifications;
use anyhow::Context;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

/// The number of hours a lender has to take a borrower's loan application.
const LOAN_APPLICATION_TIMEOUT: i64 = 24 * 7;

// We don't want the doc block below to be auto-formatted.
#[rustfmt::skip]
/// Cron syntax for checking if a loan application have expired.
///
/// The format is:
/// sec   min   hour   day of month   month   day of week   year
/// *     *     *      *              *       *             *
///
/// Meaning this one runs every 30 minutes.
const CHECK_LOAN_APPLICATION_EXPIRED_SCHEDULER: &str = "0 0/30 * * * *";

pub async fn add_loan_application_expiry_job(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
    config: Config,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let database = database.clone();
    let check_for_expiring_loan_applications_job =
        create_application_expiry_expiry_check(scheduler, database, config, notifications).await?;
    let uuid = scheduler
        .add(check_for_expiring_loan_applications_job)
        .await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to check if loan applications have expired"
    );

    Ok(())
}

async fn create_application_expiry_expiry_check(
    scheduler: &JobScheduler,
    database: Pool<Postgres>,
    config: Config,
    notifications: Arc<Notifications>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_expiring_applications_job = Job::new_async(
        CHECK_LOAN_APPLICATION_EXPIRED_SCHEDULER,
        move |_uuid, _l| {
            tracing::info!("Running job to expire loan applications");

            Box::pin({
                let database = database.clone();
                let config = config.clone();
                let notifications = notifications.clone();
                async move {
                    match db::loan_applications::expire_loan_applications(
                        &database,
                        LOAN_APPLICATION_TIMEOUT,
                    )
                    .await
                    {
                        Ok(applications) => {
                            applications.iter().for_each(|application| {
                                tracing::info!(
                                    application_id = application.application_id,
                                    "Loan application expired"
                                );
                            });
                            notify_borrowers_about_expired_application(
                                &database,
                                config.clone(),
                                applications.as_slice(),
                                notifications.clone(),
                            )
                            .await;
                        }
                        Err(err) => {
                            tracing::error!("Failed expire loan application: {err:#}");
                        }
                    }
                }
            })
        },
    )?;

    check_for_expiring_applications_job
        .on_removed_notification_add(
            scheduler,
            Box::new(|job_id, notification_id, type_of_notification| {
                Box::pin(async move {
                    tracing::error!(
                        job_id = job_id.to_string(),
                        "Cron job to check if loan applications have expired was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(check_for_expiring_applications_job)
}

async fn notify_borrowers_about_expired_application(
    db: &Pool<Postgres>,
    config: Config,
    applications: &[ExpiredApplication],
    notifications: Arc<Notifications>,
) {
    for application in applications.iter() {
        if let Err(err) = notify_borrower_about_expired_application(
            db,
            config.clone(),
            notifications.clone(),
            application,
        )
        .await
        {
            tracing::error!(
                application_id = application.application_id,
                "Failed sending notification about expired application to borrower {err:#}"
            );
        }
    }
}

async fn notify_borrower_about_expired_application(
    db: &Pool<Postgres>,
    config: Config,
    notifications: Arc<Notifications>,
    application: &ExpiredApplication,
) -> Result<()> {
    let loan_url = config
        .borrower_frontend_origin
        .join("requests")
        .expect("to be a correct URL");

    let borrower = db::borrowers::get_user_by_id(db, application.borrower_id.as_str())
        .await?
        .context("Could not find borrower")?;

    notifications
        .send_expired_loan_application_borrower(borrower, LOAN_APPLICATION_TIMEOUT / 7, loan_url)
        .await;

    Ok(())
}
