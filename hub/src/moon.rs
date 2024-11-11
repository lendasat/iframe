use crate::db;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use pay_with_moon::MoonCardClient;
use pay_with_moon::Transaction;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use time::Date;
use time::Month;
use time::OffsetDateTime;
use time::Time;
use uuid::Uuid;

/// Information about a Moon card.
///
/// The only things that can change is the `available_balance`.
#[derive(Clone, Debug)]
pub struct Card {
    pub id: Uuid,
    pub balance: Decimal,
    pub available_balance: Decimal,
    pub expiration: OffsetDateTime,
    pub pan: String,
    pub cvv: String,
    pub support_token: String,
    pub product_id: Uuid,
    pub end_customer_id: String,
    /// Cards are linked to a specific loan contract.
    pub contract_id: String,
    pub borrower_id: String,
}

/// An USDC Polygon invoice for lenders to add funds to the hub's Moon reserve.
pub struct Invoice {
    pub id: u64,
    /// Where the lender needs to send the funds.
    pub address: String,
    pub usd_amount_owed: Decimal,
    pub contract_id: String,
    pub lender_id: String,
}

#[derive(Clone)]
pub struct Manager {
    client: MoonCardClient,
    visa_product_id: Uuid,
    db: Pool<Postgres>,
}

impl Manager {
    pub fn new(
        api_key: String,
        base_url: String,
        visa_product_id: Uuid,
        db: Pool<Postgres>,
    ) -> Self {
        Self {
            client: MoonCardClient::new(api_key, base_url),
            visa_product_id,
            db,
        }
    }

    pub async fn create_card(&self, borrower_id: String, contract_id: String) -> Result<()> {
        // I'm not convinced that the API actually cares about this identifier, but let's choose
        // something relevant.
        let end_customer_id = format!("{}/{}", borrower_id, contract_id);

        let card_product_id = &self.visa_product_id;
        let res = self
            .client
            .create_card(&end_customer_id, &card_product_id.to_string())
            .await
            .context("Moon error")?;

        tracing::debug!(invoice = ?res, contract_id, borrower_id, "Created Moon card");

        let date = res.expiration.split('-').collect::<Vec<_>>();
        let year: i32 = date[0].parse().context("Year")?;
        let month: u8 = date[1].parse().context("Parse month")?;
        let month = Month::try_from(month).context("Month")?;
        let day: u8 = date[2].parse().context("Day")?;

        let date = Date::from_calendar_date(year, month, day).context("Date")?;
        let time = Time::from_hms(23, 59, 59).expect("valid time");

        let expiration = OffsetDateTime::new_utc(date, time);

        let card = Card {
            id: res.id,
            balance: res.balance,
            available_balance: res.available_balance,
            expiration,
            pan: res.pan,
            cvv: res.cvv,
            support_token: res.support_token,
            product_id: *card_product_id,
            end_customer_id,
            contract_id,
            borrower_id,
        };

        db::moon::insert_card(&self.db, card).await.context("DB")?;

        Ok(())
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

        let date = response.expiration.split('-').collect::<Vec<_>>();
        let year: i32 = date[0].parse().context("Year")?;
        let month: u8 = date[1].parse().context("Parse month")?;
        let month = Month::try_from(month).context("Month")?;
        let day: u8 = date[2].parse().context("Day")?;

        let date = Date::from_calendar_date(year, month, day).context("Date")?;
        let time = Time::from_hms(23, 59, 59).expect("valid time");

        let expiration = OffsetDateTime::new_utc(date, time);

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
            contract_id: card.contract_id.clone(),
            borrower_id: card.borrower_id.clone(),
        })
    }

    pub async fn get_transactions(&self, card_id: Uuid) -> Result<Vec<Transaction>> {
        let transactions = self
            .client
            // TODO: implement pagination
            .get_card_transactions(card_id, 1, 50)
            .await?;

        Ok(transactions)
    }

    pub async fn generate_invoice(
        &self,
        usd_amount: Decimal,
        contract_id: String,
        lender_id: String,
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

        tracing::debug!(invoice = ?res, contract_id, lender_id, "Generated a Moon invoice");

        let invoice = Invoice {
            id: res.id,
            address: res.address,
            usd_amount_owed: res.crypto_amount_owed,
            contract_id,
            lender_id,
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
}
