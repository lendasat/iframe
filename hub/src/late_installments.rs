use crate::config::Config;
use crate::db;
use crate::model::Contract;
use crate::model::ContractStatus;
use crate::notifications::Notifications;
use anyhow::Context;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
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
    config: Config,
    database: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let database = database.clone();

    tracing::info!("Running late installment job immediately on startup");
    run_late_installment_check(&database, &config, &notifications).await;

    let check_for_late_installments_job =
        create_late_installment_check(scheduler, config, database, notifications).await?;
    let uuid = scheduler.add(check_for_late_installments_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to mark installments as late"
    );

    Ok(())
}

async fn run_late_installment_check(
    db: &Pool<Postgres>,
    config: &Config,
    notifications: &Arc<Notifications>,
) {
    tracing::info!("Running late installment check");

    let late_installments = match db::installments::mark_late_installments(db).await {
        Ok(late_installments) => late_installments,
        Err(e) => {
            tracing::error!("Failed to mark installments as late: {e:#}");
            return;
        }
    };

    for late_installment in late_installments {
        let contract_id = late_installment.contract_id;

        let contract = match db::contracts::load_contract(db, &contract_id.to_string()).await {
            Ok(contract) => contract,
            Err(e) => {
                tracing::error!(
                    ?late_installment,
                    "Could not load contract for late installment: {e:#}"
                );
                continue;
            }
        };

        if !matches!(
            contract.status,
            ContractStatus::PrincipalGiven | ContractStatus::Undercollateralized
        ) {
            tracing::debug!(
                ?late_installment,
                status = ?contract.status,
                "Skipping acting on late installment of contract in irrelevant status"
            );
            continue;
        }

        if let Err(e) =
            db::contracts::mark_contract_as_defaulted(db, &contract_id.to_string()).await
        {
            tracing::error!(
                ?late_installment,
                "Could not mark contract as defaulted: {e:#}"
            );
            continue;
        }

        tracing::debug!(
            %contract_id,
            lender_id = contract.lender_id,
            borrower_id = contract.borrower_id,
            "Notifying borrower and lender about late installment"
        );

        tokio::spawn({
            let config = config.clone();
            let db = db.clone();
            let notifications = notifications.clone();
            let contract = contract.clone();
            async move {
                if let Err(e) = notify_borrower_about_late_installment(
                    &db,
                    &config,
                    &contract,
                    notifications.clone(),
                )
                .await
                {
                    tracing::error!(
                        %contract_id,
                        lender_id = contract.lender_id,
                        "Failed to notify borrower about late installment: {e:#}"
                    );
                }

                if let Err(e) = notify_lender_about_late_installment(
                    &db,
                    &config,
                    &contract,
                    notifications.clone(),
                )
                .await
                {
                    tracing::error!(
                        %contract_id,
                        lender_id = contract.lender_id,
                        "Failed notify lender about late installment: {e:#}"
                    );
                }
            }
        });
    }
}

async fn create_late_installment_check(
    scheduler: &JobScheduler,
    config: Config,
    db: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_late_installments_job =
        Job::new_async(CHECK_LATE_INSTALLMENT_SCHEDULER, move |_uuid, _l| {
            Box::pin({
                let db = db.clone();
                let config = config.clone();
                let notifications = notifications.clone();
                async move {
                    run_late_installment_check(&db, &config, &notifications).await;
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

async fn notify_borrower_about_late_installment(
    db: &Pool<Postgres>,
    config: &Config,
    contract: &Contract,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let emails = db::contract_emails::load_contract_emails(db, &contract.id).await?;
    if emails.defaulted_loan_borrower_sent {
        // email already sent;
        return Ok(());
    }

    let loan_url = config
        .borrower_frontend_origin
        .join(&format!("/my-contracts/{}", contract.id))
        .expect("to be a correct URL");

    let borrower = db::borrowers::get_user_by_id(db, &contract.borrower_id)
        .await?
        .context("Could not find borrower")?;

    notifications
        .send_loan_defaulted_borrower(db, contract.id.as_str(), borrower, loan_url)
        .await;

    Ok(())
}

async fn notify_lender_about_late_installment(
    db: &Pool<Postgres>,
    config: &Config,
    contract: &Contract,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let emails = db::contract_emails::load_contract_emails(db, &contract.id).await?;
    if emails.defaulted_loan_lender_sent {
        // email already sent;
        return Ok(());
    }

    let loan_url = config
        .lender_frontend_origin
        .join(&format!("/my-contracts/{}", contract.id))
        .expect("to be a correct URL");

    let lender = db::lenders::get_user_by_id(db, &contract.lender_id)
        .await?
        .context("Could not find lender")?;

    notifications
        .send_loan_defaulted_lender(lender, loan_url, db, &contract.id)
        .await;

    Ok(())
}
