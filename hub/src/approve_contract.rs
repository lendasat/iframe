use crate::config::Config;
use crate::db;
use crate::mempool;
use crate::mempool::AssociateNewContract;
use crate::mempool::TrackContractFunding;
use crate::model::ContractStatus;
use crate::model::FiatLoanDetailsWrapper;
use crate::notifications::Notifications;
use crate::wallet::Wallet;
use anyhow::Context;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Missing contract.
    #[error("Missing contract: {0}")]
    MissingContract(String),
    /// Failed to interact with the database.
    #[error("Failed to interact with the database.")]
    Database(#[source] anyhow::Error),
    /// Referenced loan does not exist.
    #[error("Missing loan offer: {offer_id}")]
    MissingLoanOffer { offer_id: String },
    /// An approval for a fiat loan contract request does not include the necessary fiat loan
    /// details for repayment.
    #[error("Missing bank details for fiat loan")]
    MissingFiatLoanDetails,
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
    /// Cannot approve renewal without contract address.
    #[error("Cannot approve renewal without contract address.")]
    MissingContractAddress,
}

#[allow(clippy::too_many_arguments)]
pub async fn approve_contract(
    db: &PgPool,
    wallet: &Wallet,
    mempool_actor: &xtra::Address<mempool::Actor>,
    config: &Config,
    contract_id: String,
    lender_id: &str,
    notifications: Arc<Notifications>,
    fiat_loan_details: Option<FiatLoanDetailsWrapper>,
) -> Result<(), Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_lender_id(
        db,
        contract_id.as_str(),
        lender_id,
    )
    .await
    .map_err(Error::Database)?
    .ok_or(Error::MissingContract(contract_id.clone()))?;

    if contract.status != ContractStatus::Requested
        && contract.status != ContractStatus::RenewalRequested
    {
        return Err(Error::InvalidApproveRequest {
            status: contract.status,
        });
    }

    // FIXME: I think we are no longer doing this when extending!
    if contract.status == ContractStatus::RenewalRequested {
        db::contracts::accept_extend_contract_request(db, lender_id, contract.id.as_str())
            .await
            .map_err(Error::Database)?;

        let contract_address = contract
            .contract_address
            .ok_or(Error::MissingContractAddress)?
            .assume_checked();

        mempool_actor
            .send(AssociateNewContract::new(contract_id, contract_address))
            .await
            .expect("actor to be alive")
            .map_err(Error::TrackContract)?;

        return Ok(());
    }

    let offer = db::loan_offers::loan_by_id(db, &contract.loan_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLoanOffer {
            offer_id: contract.loan_id.clone(),
        })?;

    if offer.loan_asset.is_fiat() {
        let fiat_loan_details = fiat_loan_details.ok_or(Error::MissingFiatLoanDetails)?;
        if fiat_loan_details.details.swift_transfer_details.is_none()
            && fiat_loan_details.details.iban_transfer_details.is_none()
        {
            return Err(Error::MissingFiatLoanDetails);
        }

        db::fiat_loan_details::insert_lender(db, &contract_id.to_string(), fiat_loan_details)
            .await
            .context("Failed inserting lenders fiat loan details")
            .map_err(Error::Database)?
    }

    let (contract_address, contract_index) = wallet
        .contract_address(
            contract.borrower_pk,
            contract.lender_pk,
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

    let loan_url = config
        .borrower_frontend_origin
        .join(format!("my-contracts/{}", contract.id.as_str()).as_str())
        .expect("to be a correct URL");

    // We don't want to fail this upwards because the contract request has already been
    // approved.
    if let Err(e) = async {
        notifications
            .send_loan_request_approved(borrower, loan_url)
            .await;

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
