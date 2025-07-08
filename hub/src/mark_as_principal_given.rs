use crate::config::Config;
use crate::db;
use crate::model::Contract;
use crate::notifications::Notifications;
use anyhow::Context;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn mark_as_principal_given(
    pool: &Pool<Postgres>,
    config: &Config,
    notifications: &Notifications,
    contract_id: &str,
    lender_id: &str,
    txid: Option<String>,
) -> Result<Contract> {
    let contract =
        db::contracts::load_contract_by_contract_id_and_lender_id(pool, contract_id, lender_id)
            .await
            .context("Failed to load contract request")?
            .context("contract not found")?;

    db::contracts::mark_contract_as_principal_given(pool, contract_id, contract.duration_days)
        .await
        .context("Failed to mark contract as repaid")?;

    if let Some(txid) = &txid {
        db::transactions::insert_principal_given_txid(pool, contract_id, txid.as_str())
            .await
            .context("Failed inserting principal given tx id")?;
    }

    // We don't want to fail this upwards because the contract request has been already
    // approved.
    if let Err(e) = async {
        let loan_url = config
            .borrower_frontend_origin
            .join(&format!("/my-contracts/{contract_id}"))?;

        let borrower = db::borrowers::get_user_by_id(pool, &contract.borrower_id)
            .await?
            .context("Borrower not found")?;

        // TODO: Send a custom email for indirect (e-commerce) loans.
        notifications
            .send_loan_paid_out(contract_id, borrower, loan_url)
            .await;

        anyhow::Ok(())
    }
    .await
    {
        tracing::error!("Failed at notifying borrower about loan payout: {e:#}");
    }

    Ok(contract)
}
