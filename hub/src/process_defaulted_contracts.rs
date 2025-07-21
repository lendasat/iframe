use crate::config::Config;
use crate::db;
use crate::model::generate_installments;
use crate::model::Contract;
use crate::model::ContractStatus;
use crate::model::LatePenalty;
use crate::model::RepaymentPlan;
use crate::notifications::Notifications;
use anyhow::Context;
use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use std::num::NonZeroU64;
use std::sync::Arc;
use time::OffsetDateTime;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use tokio_cron_scheduler::JobSchedulerError;

// We don't want the doc block below to be auto-formatted.
#[rustfmt::skip]
/// Cron syntax for processing contracts with late installments.
///
/// The format is:
/// sec   min   hour   day of month   month   day of week   year
/// *     *     *      *              *       *             *
///
/// Meaning this one runs every hour, with a 5 minute delay to allow the `late_installments` job to
/// complete.
const PROCESS_DEFAULTED_CONTRACTS_SCHEDULER: &str = "0 5 * * * *";

pub async fn add_process_defaulted_contracts_job(
    scheduler: &JobScheduler,
    config: Config,
    database: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let database = database.clone();

    tracing::info!("Running process defaulted contracts job immediately on startup");
    run_process_defaulted_contracts(&database, &config, &notifications).await;

    let process_defaulted_contracts_job =
        create_process_defaulted_contracts_job(scheduler, config, database, notifications).await?;
    let uuid = scheduler.add(process_defaulted_contracts_job).await?;

    tracing::debug!(
        job_id = uuid.to_string(),
        "Started new cron job to process contracts with late installments"
    );

    Ok(())
}

async fn run_process_defaulted_contracts(
    db: &Pool<Postgres>,
    config: &Config,
    notifications: &Arc<Notifications>,
) {
    tracing::info!("Running process defaulted contracts check");

    // Get all contracts with relevant statuses
    let contracts = match db::contracts::load_contracts_by_status(
        db,
        &[
            ContractStatus::PrincipalGiven,
            ContractStatus::Undercollateralized,
        ],
    )
    .await
    {
        Ok(contracts) => contracts,
        Err(e) => {
            tracing::error!("Failed to load contracts by status: {e:#}");
            return;
        }
    };

    for contract in contracts {
        // Check if this contract has any late installments
        let late_installments = match db::installments::load_late_installments_by_contract(
            db,
            &contract.id.to_string(),
        )
        .await
        {
            Ok(installments) => installments,
            Err(e) => {
                tracing::error!(
                    contract_id = %contract.id,
                    "Failed to load late installments for contract: {e:#}"
                );
                continue;
            }
        };

        if late_installments.is_empty() {
            continue;
        }

        if late_installments.len() == 1
            && matches!(
                late_installments[0].late_penalty,
                LatePenalty::InstallmentRestructure
            )
        {
            let now = OffsetDateTime::now_utc();

            // Restructure the (0-interest) installment into three, with interest.

            let mut installments = generate_installments(
                now,
                contract.id.parse().expect("UUID"),
                RepaymentPlan::InterestOnlyMonthly,
                NonZeroU64::new(90).expect("non-zero"),
                contract.interest_rate,
                contract.loan_amount,
                LatePenalty::FullLiquidation,
            );

            // The first installment's interest is doubled to account for the first month the
            // contract has already been open for.
            installments[0].interest *= Decimal::TWO;

            let mut tx = match db.begin().await {
                Ok(tx) => tx,
                Err(e) => {
                    tracing::error!(
                        contract_id = %contract.id,
                        "Failed to begin DB transaction: {e:#}"
                    );
                    continue;
                }
            };

            if let Err(e) = db::installments::insert(&mut *tx, installments).await {
                tracing::error!(
                    contract_id = %contract.id,
                    "Failed to restructure installments: {e:#}"
                );
                continue;
            }

            if let Err(e) =
                db::installments::mark_as_cancelled(&mut *tx, late_installments[0].id).await
            {
                tracing::error!(
                    contract_id = %contract.id,
                    "Failed to mark late installment as cancelled after restructuring: {e:#}"
                );
                continue;
            }

            if let Err(e) = tx.commit().await {
                tracing::error!(
                    contract_id = %contract.id,
                    "Failed to commit DB transaction: {e:#}"
                );
            }

            continue;
        }

        // Process the contract as defaulted
        if let Err(e) =
            db::contracts::mark_contract_as_defaulted(db, &contract.id.to_string()).await
        {
            tracing::error!(
                contract_id = %contract.id,
                "Could not mark contract as defaulted: {e:#}"
            );
            continue;
        }

        tracing::debug!(
            contract_id = %contract.id,
            lender_id = contract.lender_id,
            borrower_id = contract.borrower_id,
            "Notifying borrower and lender about defaulted contract"
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
                        contract_id = %contract.id,
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
                        contract_id = %contract.id,
                        lender_id = contract.lender_id,
                        "Failed notify lender about late installment: {e:#}"
                    );
                }
            }
        });
    }
}

async fn create_process_defaulted_contracts_job(
    scheduler: &JobScheduler,
    config: Config,
    db: Pool<Postgres>,
    notifications: Arc<Notifications>,
) -> Result<Job, JobSchedulerError> {
    let mut process_defaulted_contracts_job =
        Job::new_async(PROCESS_DEFAULTED_CONTRACTS_SCHEDULER, move |_uuid, _l| {
            Box::pin({
                let db = db.clone();
                let config = config.clone();
                let notifications = notifications.clone();
                async move {
                    run_process_defaulted_contracts(&db, &config, &notifications).await;
                }
            })
        })?;

    process_defaulted_contracts_job
        .on_removed_notification_add(
            scheduler,
            Box::new(|job_id, notification_id, type_of_notification| {
                Box::pin(async move {
                    tracing::error!(
                        job_id = job_id.to_string(),
                        "Cron job to process defaulted contracts was removed, notification {:?} ran ({:?})",
                        notification_id, type_of_notification
                    );
                })
            }),
        )
        .await?;

    Ok(process_defaulted_contracts_job)
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
        .send_loan_defaulted_borrower(contract.id.as_str(), borrower, loan_url)
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
        .send_loan_defaulted_lender(lender, loan_url, &contract.id)
        .await;

    Ok(())
}
