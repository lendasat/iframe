use crate::config::Config;
use crate::db;
use crate::db::moon::get_invoice_by_lendasat_id;
use crate::etherscan;
use crate::model::Contract;
use crate::model::LoanType;
use crate::moon;
use crate::notifications::Notifications;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use pay_with_moon::InvoicePayment;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn mark_as_principal_given(
    pool: &Pool<Postgres>,
    config: &Config,
    notifications: &Notifications,
    moon: &moon::Manager,
    contract_id: &str,
    lender_id: &str,
    txid: Option<String>,
) -> Result<Contract> {
    let contract =
        db::contracts::load_contract_by_contract_id_and_lender_id(pool, contract_id, lender_id)
            .await
            .context("Failed to load contract request")?
            .context("contract not found")?;

    if let Some(txid) = &txid {
        db::transactions::insert_principal_given_txid(pool, contract_id, txid.as_str())
            .await
            .context("Failed inserting principal given TXID")?;

        if contract.loan_type == LoanType::MoonCardInstant {
            let invoice = get_invoice_by_lendasat_id(pool, contract_id)
                .await
                .context("Failed to get invoice for contract")?
                .context("No invoice found for MoonCardInstant contract")?;

            let client = etherscan::Client::new(config.etherscan_api_key.clone());

            let polygon_network = match config.network {
                bitcoin::Network::Bitcoin => etherscan::PolygonNetwork::Polygon,
                _ => etherscan::PolygonNetwork::Amoy,
            };

            let borrower_loan_address = contract
                .borrower_loan_address
                .clone()
                .context("Missing borrower loan address")?;

            let payment_status = client
                .verify_payment(
                    polygon_network,
                    &borrower_loan_address,
                    txid,
                    contract.loan_amount,
                )
                .await
                .context("Failed to verify Polygon payment")?;

            match payment_status {
                etherscan::PaymentStatus::Confirmed => {
                    // Generate random payment ID. Moon will eventually tell us that the same
                    // invoice was paid, with a different payment ID. We will ignore that update
                    // because we will have already handled this one.
                    let id = Uuid::new_v4();

                    moon.handle_paid_invoice(&InvoicePayment {
                        id,
                        invoice_id: invoice.id,
                        amount: invoice.usd_amount_owed,
                        // These two fields we ignore anyway.
                        created_at: OffsetDateTime::now_utc().unix_timestamp().to_string(),
                        currency: "USD".to_string(),
                    })
                    .await
                    .context("Failed to handle paid invoice for MoonCardInstant")?
                }
                etherscan::PaymentStatus::NotFound => {
                    bail!("Invoice payment {txid} not found for contract {contract_id}");
                }
                etherscan::PaymentStatus::Insufficient => {
                    bail!("Insufficient payment {txid} for contract {contract_id}");
                }
            }
        }
    }

    db::contracts::mark_contract_as_principal_given(pool, contract_id, contract.duration_days)
        .await
        .context("Failed to mark contract as repaid")?;

    // We don't want to fail this upwards because the contract request has already been
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
