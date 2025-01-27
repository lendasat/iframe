use crate::config::Config;
use crate::db;
use crate::notifications::Notifications;
use anyhow::anyhow;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use pay_with_moon::MoonCardClient;
use pay_with_moon::Transaction;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

pub const MOON_CARD_MAX_BALANCE: Decimal = dec!(5_000);

/// Information about a Moon card.
///
/// The only things that can change is the `available_balance`.
#[derive(Clone, Debug)]
pub struct Card {
    pub id: Uuid,
    pub balance: Decimal,
    pub available_balance: Decimal,
    pub expiration: String,
    pub pan: String,
    pub cvv: String,
    pub support_token: String,
    pub product_id: Uuid,
    /// New `end_customer_id`s are generated as [`Uuid`]s, but older ones were not. Hence, we keep
    /// this as a [`String`].
    pub end_customer_id: String,
    pub borrower_id: String,
}

/// A USDC Polygon invoice for lenders to add funds to the hub's Moon reserve.
pub struct Invoice {
    pub id: Uuid,
    /// Where the lender needs to send the funds.
    pub address: String,
    pub usd_amount_owed: Decimal,
    pub contract_id: String,
    /// Optional to retain backwards-compatibility.
    pub card_id: Option<Uuid>,
    pub lender_id: String,
    pub borrower_id: String,
}

#[derive(Clone)]
pub struct Manager {
    client: MoonCardClient,
    visa_product_id: Uuid,
    db: Pool<Postgres>,
    config: Config,
    notifications: Arc<Notifications>,
}

impl Manager {
    pub fn new(db: Pool<Postgres>, config: Config, notifications: Arc<Notifications>) -> Self {
        let api_key = config.moon_api_key.clone();
        let base_url = config.moon_api_url.clone();
        let webhook_url = config.moon_webhook_url.clone();
        let visa_product_id = config.moon_visa_product_id;

        Self {
            client: MoonCardClient::new(api_key, base_url, webhook_url),
            visa_product_id,
            db,
            config,
            notifications,
        }
    }

    pub async fn create_card(&self, borrower_id: String) -> Result<Card> {
        let end_customer_id = Uuid::new_v4();

        let card_product_id = &self.visa_product_id;
        let response = self
            .client
            .create_card(&end_customer_id.to_string(), &card_product_id.to_string())
            .await
            .context("Moon error")?;

        tracing::debug!(?response, borrower_id, "Created Moon card");

        let card = response.card;

        let expiration = card.display_expiration;

        let card = Card {
            id: card.id,
            balance: card.balance,
            available_balance: dec!(0),
            expiration,
            pan: card.pan,
            cvv: card.cvv,
            support_token: card.support_token,
            product_id: *card_product_id,
            end_customer_id: end_customer_id.to_string(),
            borrower_id,
        };

        db::moon::insert_card(&self.db, card.clone())
            .await
            .context("DB")?;

        Ok(card)
    }

    pub async fn get_cards_from_db(&self, borrower_id: String) -> Result<Vec<Card>> {
        let cards = db::moon::get_borrower_cards(&self.db, &borrower_id)
            .await
            .context("DB")?;

        Ok(cards)
    }

    pub async fn fetch_card_details_from_moon(&self, card: &Card) -> Result<Card> {
        let response = self.client.get_card(card.id).await?;
        if response.id != card.id {
            bail!("Received wrong card");
        }

        let expiration = response.display_expiration;

        Ok(Card {
            id: response.id,
            balance: response.balance,
            available_balance: response.available_balance,
            expiration,
            pan: response.pan,
            cvv: response.cvv,
            support_token: response.support_token,
            product_id: response.card_product_id,
            end_customer_id: card.end_customer_id.clone(),
            borrower_id: card.borrower_id.clone(),
        })
    }

    pub async fn sync_transaction_history(&self) -> Result<()> {
        let card_ids = db::moon::get_all_card_ids(&self.db).await?;
        for card_id in card_ids.iter() {
            let txs = self.get_transactions(*card_id).await?;
            db::moon::insert_transactions(&self.db, txs).await?
        }
        Ok(())
    }

    pub async fn get_transactions(&self, card_id: Uuid) -> Result<Vec<Transaction>> {
        let transactions = self.client.get_all_transactions(card_id).await?;

        Ok(transactions)
    }

    pub async fn generate_invoice(
        &self,
        usd_amount: Decimal,
        contract_id: String,
        card_id: Uuid,
        lender_id: String,
        borrower_id: &str,
    ) -> Result<Invoice> {
        let res = self
            .client
            .generate_invoice(
                usd_amount,
                pay_with_moon::Blockchain::Polygon,
                pay_with_moon::Currency::Usdc,
            )
            .await
            .context("Moon error")?;

        tracing::debug!(invoice = ?res, %card_id, lender_id, borrower_id, "Generated a Moon invoice");

        let invoice = Invoice {
            id: res.id,
            address: res.address,
            usd_amount_owed: res.crypto_amount_owed,
            contract_id,
            card_id: Some(card_id),
            lender_id,
            borrower_id: borrower_id.to_string(),
        };

        Ok(invoice)
    }

    // We had to split persisting the invoice from generating it because the loan contract is
    // persisted using information from the invoice (the invoice address is used as the borrower
    // loan address), and the persisted invoice references the contract ID too.
    pub async fn persist_invoice(&self, invoice: &Invoice) -> Result<()> {
        db::moon::insert_moon_invoice(&self.db, invoice)
            .await
            .context("DB")?;

        Ok(())
    }

    pub async fn register_webhook(&self) -> Result<()> {
        self.client.register_webhook().await?;

        Ok(())
    }

    pub async fn handle_paid_invoice(&self, payment: &pay_with_moon::InvoicePayment) -> Result<()> {
        let invoice_id = payment.invoice_id;
        let payment_id = payment.id;

        // First we register the payment, no matter what.
        if let Err(err) = db::moon::insert_moon_invoice_payment(
            &self.db,
            payment_id,
            invoice_id,
            &payment.amount,
            payment.currency.as_str(),
        )
        .await
        {
            tracing::error!(?payment, "Failed at inserting invoice payment: {err:#}");

            bail!("Failed at inserting invoice payment")
        }

        // Next, we check if we have an invoice we need to mark as paid.
        let invoice = match db::moon::get_invoice_by_id(&self.db, invoice_id).await? {
            Some(invoice) => invoice,
            None => {
                tracing::warn!(
                    %invoice_id,
                    amount = %payment.amount,
                    "Payment received for unknown invoice"
                );

                bail!("Payment received for unknown invoice")
            }
        };

        if invoice.is_paid {
            tracing::warn!(
                %invoice_id,
                card_id = ?invoice.card_id,
                borrower_id = invoice.borrower_id,
                "Ignoring payment for already paid invoice"
            );

            return Ok(());
        }

        if invoice.usd_amount_owed > payment.amount {
            tracing::error!(
                %invoice_id,
                needed_amount = %invoice.usd_amount_owed,
                received_amount = %payment.amount,
                "Insufficient payment amount"
            );

            bail!("Insufficient payment amount received");
        }

        // Mark the invoice as paid
        db::moon::mark_invoice_as_paid(&self.db, invoice_id)
            .await
            .map_err(|err| {
                tracing::error!(
                    %invoice_id,
                    amount = %invoice.usd_amount_owed,
                    error = ?err,
                    "Failed to mark invoice as paid"
                );

                anyhow!("DB error when marking invoice as paid")
            })?;

        tracing::info!(
            %invoice_id,
            amount = %payment.amount,
            "Invoice successfully paid"
        );

        let card_id = invoice.card_id.context("No card found for invoice")?;
        let card_id = Uuid::from_str(&card_id).context("Invalid card ID")?;

        let response = self.client.add_balance(card_id, payment.amount).await?;

        tracing::info!(
            card_id = response.id.to_string(),
            balance = response.balance.to_string(),
            available_balance = response.available_balance.to_string(),
            "Assigned balance to card"
        );

        //TODO: notify the user via email that the card is ready to use
        let borrower = db::borrowers::get_user_by_id(&self.db, invoice.borrower_id.as_str())
            .await
            .context("Failed loading borrower")?
            .context("Borrower not found")?;

        let card_details_url =
            format!("{}/cards", self.config.borrower_frontend_origin.to_owned(),);

        self.notifications
            .send_moon_card_ready(borrower, card_details_url.as_str())
            .await
            .context("Failed to send moon-card-ready email")?;

        Ok(())
    }
}
