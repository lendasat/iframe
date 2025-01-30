use crate::config::Config;
use crate::db;
use crate::mempool;
use crate::mempool::TrackContractFunding;
use crate::model::ContractStatus;
use crate::notifications::Notifications;
use crate::wallet::Wallet;
use anyhow::Context;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::MutexGuard;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Failed to interact with the database.
    #[error("Failed to interact with the database.")]
    Database(#[source] anyhow::Error),
    /// Can't do much of anything without lender Xpub.
    #[error("Missing lender xpub")]
    MissingLenderXpub,
    /// Failed to generate contract address.
    #[error("Failed to generate contract address.")]
    ContractAddress(#[source] anyhow::Error),
    /// Referenced borrower does not exist.
    #[error("Referenced borrower does not exist.")]
    MissingBorrower,
    /// Failed to track accepted contract using Mempool API.
    #[error("Failed to track accepted contract using Mempool API.")]
    TrackContract(#[source] anyhow::Error),
    /// The contract was in an invalid state
    #[error("The contract was in an invalid state: {status:?}")]
    InvalidApproveRequest { status: ContractStatus },
    /// Notifying the user failed
    #[error("Failed to notify the user.")]
    Notification(#[source] crate::notifications::Error),
}

pub async fn approve_contract(
    db: &PgPool,
    wallet: MutexGuard<'_, Wallet>,
    mempool_actor: &xtra::Address<mempool::Actor>,
    config: &Config,
    contract_id: String,
    lender_id: &str,
    notifications: Arc<Notifications>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        db,
        contract_id.as_str(),
        lender_id,
    )
    .await
    .map_err(Error::Database)?;

    if contract.status != ContractStatus::Requested
        && contract.status != ContractStatus::RenewalRequested
    {
        return Err(Error::InvalidApproveRequest {
            status: contract.status,
        });
    }

    if contract.status == ContractStatus::RenewalRequested {
        db::contracts::accept_extend_contract_request(db, lender_id, contract.id.as_str())
            .await
            .map_err(Error::Database)?;
        return Ok(());
    }

    let lender_xpub = contract.lender_xpub.ok_or(Error::MissingLenderXpub)?;

    let (contract_address, contract_index) = wallet
        .contract_address(
            contract.borrower_pk,
            &lender_xpub,
            contract.contract_version,
        )
        .await
        .map_err(Error::ContractAddress)?;

    let borrower = db::borrowers::get_user_by_id(db, contract.borrower_id.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingBorrower)?;

    let mut db_tx = db
        .begin()
        .await
        .context("Failed to start DB transaction")
        .map_err(Error::Database)?;

    let contract = db::contracts::accept_contract_request(
        &mut db_tx,
        lender_id,
        contract_id.as_str(),
        contract_address.clone(),
        contract_index,
    )
    .await
    .map_err(Error::Database)?;

    mempool_actor
        .send(TrackContractFunding::new(contract_id, contract_address))
        .await
        .expect("actor to be alive")
        .map_err(Error::TrackContract)?;

    let loan_url = format!(
        "{}/my-contracts/{}",
        config.borrower_frontend_origin.to_owned(),
        contract.id
    );

    // We don't want to fail this upwards because the contract request has already been
    // approved.
    if let Err(e) = async {
        notifications
            .send_loan_request_approved(borrower, loan_url.as_str())
            .await
            .map_err(Error::Notification)?;

        db::contract_emails::mark_loan_request_approved_as_sent(db, &contract.id)
            .await
            .context("Failed to mark loan-request-approved email as sent")?;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying borrower about loan request approval: {e:#}");
    }

    db_tx
        .commit()
        .await
        .context("Failed to finish DB transaction")
        .map_err(Error::Database)?;

    Ok(())
}
