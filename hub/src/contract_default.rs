use crate::config::Config;
use crate::db;
use crate::db::contracts::DefaultedContract;
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
    config: Config,
    database: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let database = database.clone();
    let check_for_expiring_contracts_job =
        create_contract_expiry_check(scheduler, config, database, notifications).await?;
    let uuid = scheduler.add(check_for_expiring_contracts_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to default expired contracts"
    );

    Ok(())
}

async fn create_contract_expiry_check(
    scheduler: &JobScheduler,
    config: Config,
    db: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_expiring_contracts_job = Job::new_async(
        CHECK_CONTRACT_DEFAULT_SCHEDULER,
        move |_uuid, _l| {
            tracing::info!("Running job");

            Box::pin({
                let db = db.clone();
                let config = config.clone();
                let notifications = notifications.clone();
                async move {
                    match db::contracts::default_expired_contracts(&db).await {
                        Ok(contracts) => {
                            for contract in contracts {
                                tracing::info!(
                                    contract_id = contract.contract_id,
                                    lender_id = contract.lender_id,
                                    borrower_id = contract.borrower_id,
                                    "Notifying borrower and lender about defaulted contract."
                                );

                                tokio::spawn({
                                    let config = config.clone();
                                    let db = db.clone();
                                    let notifications = notifications.clone();
                                    let contract = contract.clone();
                                    async move {
                                        if let Err(e) = notify_borrower_about_defaulted_loan(
                                            db.clone(),
                                            config.clone(),
                                            contract.clone(),
                                            notifications.clone(),
                                        )
                                        .await
                                        {
                                            tracing::error!(
                                                contract_id=contract.contract_id,
                                                lender_id=contract.lender_id,
                                                "Failed notify borrower about defaulted loan. Error: {e:#}");
                                        }

                                        if let Err(e) = notify_lender_about_defaulted_loan(
                                            db.clone(),
                                            config.clone(),
                                            contract.clone(),
                                            notifications.clone(),
                                        )
                                        .await
                                        {
                                            tracing::error!(contract_id=contract.contract_id,
                                                lender_id=contract.lender_id,
                                                "Failed notify lender about defaulted loan. Error: {e:#}");
                                        }
                                    }
                                });
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to default expired contracts: {e:#}");
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
                        "Cron job to default expired contracts was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(check_for_expiring_contracts_job)
}

async fn notify_borrower_about_defaulted_loan(
    db: Pool<Postgres>,
    config: Config,
    contract: DefaultedContract,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let loan_url = format!(
        "{}/my-contracts/{}",
        config.borrower_frontend_origin, contract.contract_id
    );

    let borrower = db::borrowers::get_user_by_id(&db, contract.borrower_id.as_str())
        .await?
        .context("Could not find borrower")?;

    notifications
        .send_loan_defaulted_borrower(borrower, loan_url.as_str())
        .await;

    Ok(())
}

async fn notify_lender_about_defaulted_loan(
    db: Pool<Postgres>,
    config: Config,
    contract: DefaultedContract,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let loan_url = format!(
        "{}/my-contracts/{}",
        config.lender_frontend_origin, contract.contract_id
    );

    let lender = db::lenders::get_user_by_id(&db, contract.lender_id.as_str())
        .await?
        .context("Could not find lender")?;

    notifications
        .send_loan_defaulted_lender(lender, loan_url.as_str())
        .await;

    Ok(())
}
