use crate::db;
use crate::db::contracts::ExpiredContract;
use crate::notifications::Notifications;
use anyhow::Context;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
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
    notifications: Arc<Notifications>,
) -> Result<()> {
    let database = database.clone();
    let check_for_expiring_contracts_job =
        create_contract_request_expiry_check(scheduler, database, notifications).await?;
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
    notifications: Arc<Notifications>,
) -> Result<Job, JobSchedulerError> {
    let mut check_for_expiring_contracts_job = Job::new_async(
        CHECK_CONTRACT_REQUESTS_EXPIRED_SCHEDULER,
        move |_uuid, _l| {
            tracing::info!("Running job to expire contracts");

            Box::pin({
                let database = database.clone();
                let notifications = notifications.clone();
                async move {
                    match db::contracts::expire_requested_contracts(
                        &database,
                        CONTRACT_REQUEST_TIMEOUT,
                        CONTRACT_REQUEST_KYC_PENDING_TIMEOUT,
                    )
                    .await
                    {
                        Ok(contracts) => {
                            contracts.iter().for_each(|contract| {
                                tracing::info!(
                                    contract_id = contract.contract_id,
                                    "Contract request expired"
                                );
                            });
                            // Restore loan amounts for expired contracts and mark offers as
                            // unavailable
                            expire_loan_offers(&database, contracts.as_slice()).await;
                            notify_borrowers_about_expired_contracts(
                                &database,
                                contracts.as_slice(),
                                notifications.clone(),
                            )
                            .await;
                            notify_lenders_about_expired_offer(
                                &database,
                                contracts.as_slice(),
                                notifications.clone(),
                            )
                            .await;
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

async fn expire_loan_offers(database: &Pool<Postgres>, contracts: &[ExpiredContract]) {
    // First restore the loan amounts for each expired contract
    for contract in contracts {
        restore_loan_amount_for_expired_contract(database, contract).await;
    }

    // Then set the loan offers as unavailable
    let ids = contracts
        .iter()
        .map(|c| c.contract_id.clone())
        .collect::<Vec<_>>();
    match db::loan_offers::set_loan_offers_unavailable_by_contract_id(database, ids.as_slice())
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

async fn restore_loan_amount_for_expired_contract(
    database: &Pool<Postgres>,
    expired_contract: &ExpiredContract,
) {
    // Get the loan offer to update its loan_amount_max
    if let Ok(Some(offer)) =
        db::loan_offers::loan_by_id(database, &expired_contract.loan_deal_id).await
    {
        if let Err(e) = db::loan_offers::increase_loan_amount_max(
            database,
            &offer.loan_deal_id,
            expired_contract.loan_amount,
        )
        .await
        {
            tracing::error!(
                "Failed to restore loan_amount_max for offer {} after contract expiry: {e:#}",
                offer.loan_deal_id
            );
        }
        tracing::info!(
            contract_id = expired_contract.contract_id,
            offer_id = offer.loan_deal_id,
            restored_amount = %expired_contract.loan_amount,
            "Restored loan_amount_max for expired contract request"
        );
    }
}

async fn notify_borrowers_about_expired_contracts(
    db: &Pool<Postgres>,
    contracts: &[ExpiredContract],
    notifications: Arc<Notifications>,
) {
    for contract in contracts.iter() {
        if let Err(err) =
            notify_borrower_about_expired_contracts(db, notifications.clone(), contract).await
        {
            tracing::error!(
                contract_id = contract.contract_id,
                "Failed sending notification about expired contracts to borrower {err:#}"
            );
        }
    }
}

async fn notify_borrower_about_expired_contracts(
    db: &Pool<Postgres>,
    notifications: Arc<Notifications>,
    contract: &ExpiredContract,
) -> Result<()> {
    let emails =
        db::contract_emails::load_contract_emails(db, contract.contract_id.as_str()).await?;
    if emails.loan_request_expired_borrower_sent {
        // email already sent;
        return Ok(());
    }

    let borrower = db::borrowers::get_user_by_id(db, contract.borrower_id.as_str())
        .await?
        .context("Could not find borrower")?;

    notifications
        .send_expired_loan_request_borrower(contract.contract_id.as_str(), borrower)
        .await;

    Ok(())
}

async fn notify_lenders_about_expired_offer(
    db: &Pool<Postgres>,
    contracts: &[ExpiredContract],
    notifications: Arc<Notifications>,
) {
    for contract in contracts.iter() {
        if let Err(err) =
            notify_lender_about_expired_offer(db, notifications.clone(), contract).await
        {
            tracing::error!(
                contract_id = contract.contract_id,
                "Failed sending notification about expired contracts to lender {err:#}"
            );
        }
    }
}

async fn notify_lender_about_expired_offer(
    db: &Pool<Postgres>,
    notifications: Arc<Notifications>,
    contract: &ExpiredContract,
) -> Result<()> {
    let emails =
        db::contract_emails::load_contract_emails(db, contract.contract_id.as_str()).await?;
    if emails.loan_request_expired_lender_sent {
        // email already sent;
        return Ok(());
    }

    let lender = db::lenders::get_user_by_id(db, contract.lender_id.as_str())
        .await?
        .context("Could not find lender")?;

    notifications
        .send_expired_loan_request_lender(lender, contract.contract_id.as_str())
        .await;

    Ok(())
}
