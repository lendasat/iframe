use crate::config::Config;
use crate::db;
use crate::notifications::Notifications;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use time::format_description;
use time::OffsetDateTime;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

// We don't want the doc block below to be auto-formatted.
#[rustfmt::skip]
/// Cron syntax for checking if installments are close to their due date.
///
/// The format is:
/// sec   min   hour   day of month   month   day of week   year
/// *     *     *      *              *       *             *
///
/// Meaning this one runs every day at 12 pm.
const CHECK_INSTALLMENT_CLOSE_TO_DUE_DATE_SCHEDULER: &str = "0 0 12 * * *";

pub async fn add_installment_close_to_due_date_job(
    scheduler: &JobScheduler,
    config: Config,
    db: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let db = db.clone();
    let check_for_close_to_due_date_installments_job =
        create_installment_close_to_due_date_check(scheduler, config, db, notifications).await?;
    let uuid = scheduler
        .add(check_for_close_to_due_date_installments_job)
        .await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to check if installments are close to due date"
    );

    Ok(())
}

async fn create_installment_close_to_due_date_check(
    scheduler: &JobScheduler,
    config: Config,
    db: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_close_to_due_date_installments_job = Job::new_async(
        CHECK_INSTALLMENT_CLOSE_TO_DUE_DATE_SCHEDULER,
        move |_uuid, _l| {
            tracing::info!("Running job");

            Box::pin({
                let db = db.clone();
                let config = config.clone();
                let notifications = notifications.clone();
                async move {
                    let installments =
                        match db::installments::get_close_to_due_date_installments(&db).await {
                            Ok(installments) => installments,
                            Err(e) => {
                                tracing::error!(
                                    "Failed to get installments close to due date: {e:#}"
                                );
                                return;
                            }
                        };

                    for installment in installments {
                        let contract_id = installment.contract_id;
                        let contract =
                            match db::contracts::load_contract(&db, &contract_id.to_string()).await
                            {
                                Ok(contract) => contract,
                                Err(e) => {
                                    tracing::error!(
                                        ?installment,
                                        "Could not load contract for installment due soon: {e:#}"
                                    );
                                    return;
                                }
                            };

                        tracing::debug!(
                            %contract_id,
                            lender_id = contract.lender_id,
                            borrower_id = contract.borrower_id,
                            "Notifying borrower about installment that is due soon"
                        );

                        tokio::spawn({
                            let config = config.clone();
                            let notifications = notifications.clone();
                            let db = db.clone();
                            async move {
                                let loan_url = config
                                    .borrower_frontend_origin
                                    .join(&format!("/my-contracts/{contract_id}"))
                                    .expect("to be a correct URL");

                                match db::borrowers::get_user_by_id(&db, &contract.borrower_id)
                                    .await
                                {
                                    Ok(Some(borrower)) => {
                                        notifications
                                            .send_installment_due_soon(
                                                contract_id.to_string().as_str(),
                                                installment.id,
                                                borrower,
                                                &formatted_date(installment.due_date),
                                                loan_url,
                                            )
                                            .await;
                                    }
                                    Ok(None) => tracing::error!(
                                        %contract_id,
                                        borrower_id = contract.borrower_id,
                                        "Couldn't find borrower"
                                    ),
                                    Err(e) => tracing::error!(
                                        %contract_id,
                                        borrower_id = contract.borrower_id,
                                        "Failed to get borrower by ID: {e:#}"
                                    ),
                                }
                            }
                        });
                    }
                }
            })
        },
    )?;

    check_for_close_to_due_date_installments_job
        .on_removed_notification_add(
            scheduler,
            Box::new(|job_id, notification_id, type_of_notification| {
                Box::pin(async move {
                    tracing::error!(
                        job_id = job_id.to_string(),
                        "Cron job to check if installment is close to due date was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(check_for_close_to_due_date_installments_job)
}

fn formatted_date(date: OffsetDateTime) -> String {
    let format = format_description::well_known::Rfc3339;

    date.to_offset(time::UtcOffset::UTC)
        .format(&format)
        .expect("valid date")
}
