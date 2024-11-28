use reqwest::Client;
use rust_decimal::Decimal;
use serde::de;
use serde::de::Visitor;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde_json::Value;
use std::fmt;
use time::OffsetDateTime;
use uuid::Uuid;

// Production API URL: https://api.paywithmoon.com/v1/api-gateway
// Mocked API URL: https://virtserver.swaggerhub.com/Moon6/Moon-card-issuing/1.0.6/v1/api-gateway
// Staging API URL: https://stagingapi.paywithmoon.com/v1/api-gateway

#[derive(Debug, Deserialize)]
pub struct CreateCardResponseWrapper {
    pub message: String,
    pub card: CreateCardResponse,
}

#[derive(Debug, Deserialize)]
pub struct CreateCardResponse {
    /// The unique public identifier for the card.
    pub id: Uuid,
    /// The value of the card.
    #[serde(with = "rust_decimal::serde::float")]
    pub balance: Decimal,
    /// The expiration date of the card in MM/YY format.
    pub display_expiration: String,
    /// Indicates if the card has been terminated (deleted).
    #[serde(deserialize_with = "int_to_bool")]
    pub terminated: bool,
    /// The identifier of the card product associated with the card.
    ///
    /// This seems to be tied to our API key i.e. it doesn't change between cards.
    pub card_product_id: Uuid,
    /// The Primary Account Number (PAN) of the card.
    pub pan: String,
    /// The Card Verification Value (CVV) of the card.
    pub cvv: String,
    /// The support token associated with the card.
    pub support_token: String,
    /// Indicates if the card is currently frozen.
    #[serde(deserialize_with = "int_to_bool")]
    pub frozen: bool,
}

#[derive(Debug, Deserialize)]
pub struct GetCardResponse {
    /// The unique public identifier for the card.
    pub id: Uuid,
    /// The value of the card.
    #[serde(with = "rust_decimal::serde::str")]
    pub balance: Decimal,
    /// The card's available balance.
    #[serde(with = "rust_decimal::serde::str")]
    pub available_balance: Decimal,
    /// The expiration date of the card in MM/YY format.
    pub display_expiration: String,
    /// Indicates if the card has been terminated (deleted).
    #[serde(deserialize_with = "int_to_bool")]
    pub terminated: bool,
    /// The identifier of the card product associated with the card.
    ///
    /// This seems to be tied to our API key i.e. it doesn't change between cards.
    pub card_product_id: Uuid,
    /// The Primary Account Number (PAN) of the card.
    pub pan: String,
    /// The Card Verification Value (CVV) of the card.
    pub cvv: String,
    /// The support token associated with the card.
    pub support_token: String,
    /// Indicates if the card is currently frozen.
    #[serde(deserialize_with = "int_to_bool")]
    pub frozen: bool,
    pub gift_card_info: GiftCardInfo,
}

#[derive(Debug, Deserialize, PartialEq)]
pub struct AddBalanceResponse {
    /// The unique public identifier for the card.
    pub id: Uuid,
    /// The value of the card.
    #[serde(with = "rust_decimal::serde::float")]
    pub balance: Decimal,
    /// The card's available balance.
    #[serde(with = "rust_decimal::serde::float")]
    pub available_balance: Decimal,
    /// The expiration date of the card. Date format in `[year]-[month]-[day]`, e.g. `2024-11-01`.
    ///
    /// We can't use `#[serde(with = "time::serde::iso8601")]`, because we are missing data.
    pub expiration: String,
    /// The expiration date of the card in MM/YY format.
    pub display_expiration: String,
    /// The Primary Account Number (PAN) of the card.
    pub pan: String,
    /// The Card Verification Value (CVV) of the card.
    pub cvv: String,
    /// The support token associated with the card.
    pub support_token: String,
    /// An unknown, undocumented token.
    pub token: Uuid,
}

#[derive(Debug, Deserialize, PartialEq)]
pub struct GiftCardInfo {
    pub barcode: Option<String>,
    pub pin: Option<String>,
    pub security_code: Option<String>,
    pub merchant_card_website: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TransactionResponse {
    pub transactions: Vec<Transaction>,
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
#[serde(tag = "type", content = "data")]
pub enum Transaction {
    #[serde(rename = "CARD_TRANSACTION")]
    CardTransaction(TransactionData),
    #[serde(rename = "CARD_AUTHORIZATION_REFUND")]
    CardAuthorizationRefund(TransactionData),
    #[serde(rename = "DECLINE")]
    DeclineData(DeclineData),
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
#[serde(tag = "type", content = "data")]
pub enum MoonMessage {
    #[serde(rename = "CARD_TRANSACTION")]
    CardTransaction(TransactionData),
    #[serde(rename = "CARD_AUTHORIZATION_REFUND")]
    CardAuthorizationRefund(TransactionData),
    #[serde(rename = "DECLINE")]
    DeclineData(DeclineData),
    #[serde(rename = "MOON_CREDIT_FUNDS_CREDITED")]
    MoonInvoicePayment(InvoicePayment),
    #[serde(untagged)]
    Unknown(Value),
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
pub struct DeclineData {
    /// The date we receive has the following format: 2024-11-14 10:26:24
    pub datetime: String,
    pub merchant: String,
    pub customer_friendly_description: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub card: TransactionCard,
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
pub enum TransactionStatus {
    #[serde(rename = "AUTHORIZATION")]
    Authorization,
    #[serde(rename = "REVERSAL")]
    Reversal,
    #[serde(rename = "CLEARING")]
    Clearing,
    #[serde(rename = "REFUND")]
    Refund,
    #[serde(rename = "PENDING")]
    Pending,
    #[serde(rename = "SETTLED")]
    Settled,
    #[serde(untagged)]
    Unknown(String),
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransactionData {
    pub card: TransactionCard,
    pub transaction_id: Uuid,
    pub transaction_status: TransactionStatus,
    /// Date when the transaction happened
    /// The date we receive has the following format: 2024-11-14 10:26:24
    pub datetime: String,
    pub merchant: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    pub ledger_currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_fees_in_ledger_currency: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_in_transaction_currency: Decimal,
    pub transaction_currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_fees_in_transaction_currency: Decimal,
    pub fees: Vec<Fee>,
}

pub struct TransactionDataWrapper {
    pub data: TransactionData,
    pub tag: String,
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
pub struct TransactionCard {
    pub public_id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub card_type: String,
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Fee {
    #[serde(rename = "type")]
    pub fee_type: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    pub fee_description: String,
}

#[derive(Debug, Deserialize)]
pub struct FreezeResponse {
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct InvoiceResponse {
    invoice: Invoice,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    /// The invoice's on-chain invoice ID.
    pub id: Uuid,
    /// The invoice's address.
    pub address: String,
    /// The invoice's USD amount owed.
    #[serde(with = "rust_decimal::serde::str")]
    pub usd_amount_owed: Decimal,
    /// The invoice's crypto amount owed.
    #[serde(with = "rust_decimal::serde::str")]
    pub crypto_amount_owed: Decimal,
    /// The invoice's exchange rate lock expiration (timestamp). This can be ignored for USDC.
    #[serde(with = "time::serde::timestamp::milliseconds")]
    pub exchange_rate_lock_expiration: OffsetDateTime,
    /// The currency to be paid.
    pub currency: Currency,
    /// The blockchain over which to make the payment.
    pub blockchain: Blockchain,
}

#[derive(Debug, Deserialize)]
pub struct Balance {
    #[serde(with = "rust_decimal::serde::float")]
    pub balance: Decimal,
}

#[derive(Deserialize, Debug)]
pub struct Merchant {
    pub id: String,
    pub name: String,
    pub description: String,
    pub redemption_instructions: String,
    pub primary_text_color: String,
    pub primary_brand_color: String,
}

#[derive(Deserialize, Debug)]
pub struct GiftCard {
    pub id: Uuid,
    pub name: String,
    // TODO: Not sure how to deserialize this
    // denominations: Vec<Decimal>,
    #[serde(with = "rust_decimal::serde::float")]
    pub minimum_value: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub maximum_value: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub fee_amount: Decimal,
    /// The type of fee for the card product (e.g., 'fixed', 'percentage').
    pub fee_type: String,
    pub merchant: Merchant,
    pub categories: Vec<String>,
    #[serde(with = "rust_decimal::serde::float")]
    pub discount_percentage: Decimal,
}

#[derive(Deserialize, Debug)]
pub struct CardProducts {
    pub card_products: Vec<CardProduct>,
    // TODO: There might be more pages.
}

#[derive(Deserialize, Debug)]
pub struct CardProduct {
    pub id: Uuid,
    pub name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub minimum_value: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub maximum_value: Decimal,
    // TODO: There might be more things, but we can't trust the docs.
}

#[derive(Clone)]
pub struct MoonCardClient {
    client: Client,
    api_key: String,
    base_url: String,
    webhook_url: String,
}

#[derive(Clone, Copy, Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum Blockchain {
    Polygon,
    Bitcoin,
}

#[derive(Clone, Copy, Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum Currency {
    Usdc,
    Btc,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct InvoicePayment {
    pub id: Uuid,
    pub invoice_id: Uuid,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    pub created_at: String,
    pub currency: String,
}

impl MoonCardClient {
    pub fn new(api_key: String, base_url: String, webhook_url: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            base_url,
            webhook_url,
        }
    }

    pub async fn create_card(
        &self,
        end_customer_id: &str,
        card_product_id: &str,
    ) -> Result<CreateCardResponseWrapper, reqwest::Error> {
        let url = format!("{}/card/{}", self.base_url, card_product_id);

        // TODO: Figure out how we can use the `end_customer_id`.
        let body = serde_json::json!({ "end_customer_id": end_customer_id });

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .error_for_status();

        match response {
            Ok(response) => response.json::<CreateCardResponseWrapper>().await,
            Err(error) => {
                tracing::error!("Failed at creating a card {error}");
                Err(error)
            }
        }
    }

    pub async fn get_card(&self, card_id: Uuid) -> Result<GetCardResponse, reqwest::Error> {
        let url = format!("{}/card/{}", self.base_url, card_id);

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .error_for_status();

        match response {
            Ok(response) => response.json::<GetCardResponse>().await,
            Err(error) => {
                tracing::error!("Failed at getting card {error}");
                Err(error)
            }
        }
    }

    pub async fn add_balance(
        &self,
        card_id: Uuid,
        amount: Decimal,
    ) -> Result<AddBalanceResponse, reqwest::Error> {
        let url = format!("{}/card/{}/add_balance", self.base_url, card_id);
        let body = serde_json::json!({ "amount": amount.to_string() });

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .error_for_status();
        match response {
            Ok(response) => response.json::<AddBalanceResponse>().await,
            Err(error) => {
                tracing::error!(
                    card_id = card_id.to_string(),
                    "Failed at adding balance to card {error}"
                );
                Err(error)
            }
        }
    }

    pub async fn freeze_card(
        &self,
        card_id: Uuid,
        frozen: bool,
    ) -> Result<FreezeResponse, reqwest::Error> {
        let url = format!("{}/card/{}/freeze", self.base_url, card_id);
        let body = serde_json::json!({ "frozen": frozen });

        let response = self
            .client
            .patch(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .error_for_status();
        match response {
            Ok(response) => response.json::<FreezeResponse>().await,
            Err(error) => {
                tracing::error!(
                    card_id = card_id.to_string(),
                    "Failed at freezing a card {error}"
                );
                Err(error)
            }
        }
    }

    pub async fn get_card_transactions(
        &self,
        card_id: Uuid,
        current_page: u32,
        per_page: u32,
    ) -> Result<Vec<Transaction>, reqwest::Error> {
        let url = format!(
            "{}/card/{}/transactions?currentPage={}&perPage={}",
            self.base_url, card_id, current_page, per_page
        );

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .error_for_status();
        // TODO: use inspect error instead
        match response {
            Ok(response) => {
                let txs = response.json::<TransactionResponse>().await?.transactions;
                Ok(txs)
            }
            Err(error) => {
                tracing::error!(
                    card_id = card_id.to_string(),
                    "Failed at getting card transactions {error}"
                );
                Err(error)
            }
        }
    }

    pub async fn generate_invoice(
        &self,
        usd_amount: Decimal,
        blockchain: Blockchain,
        currency: Currency,
    ) -> Result<Invoice, reqwest::Error> {
        let url = format!("{}/onchain/invoice", self.base_url);
        let body = serde_json::json!({
            "creditPurchaseAmount": usd_amount,
            "blockchain": blockchain,
            "currency": currency,
        });

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .error_for_status();
        match response {
            Ok(response) => {
                let invoice = response.json::<InvoiceResponse>().await?.invoice;

                Ok(invoice)
            }
            Err(error) => {
                tracing::error!("Failed at generating invoice {error}");
                Err(error)
            }
        }
    }

    pub async fn get_moon_reserve_balance(&self) -> Result<Balance, reqwest::Error> {
        let url = format!("{}/moon-reserve", self.base_url);

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .error_for_status();

        match response {
            Ok(response) => response.json::<Balance>().await,
            Err(error) => {
                tracing::error!("Failed at getting moon reserve balance {error}");
                Err(error)
            }
        }
    }

    pub async fn get_card_products(&self) -> Result<CardProducts, reqwest::Error> {
        let url = format!("{}/card-products", self.base_url);

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .error_for_status();
        match response {
            Ok(response) => response.json::<CardProducts>().await,
            Err(error) => {
                tracing::error!("Failed at getting card products {error}");
                Err(error)
            }
        }
    }

    pub async fn register_webhook(&self) -> Result<(), reqwest::Error> {
        let url = format!("{}/webhook", self.base_url);

        let body = serde_json::json!({
            "url": self.webhook_url,
        });

        self.client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }

    pub async fn delete_webhook(&self) -> Result<(), reqwest::Error> {
        let url = format!("{}/webhook", self.base_url);

        self.client
            .delete(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }
}

fn int_to_bool<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    struct IntVisitor;

    impl<'de> Visitor<'de> for IntVisitor {
        type Value = bool;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a 0 or a 1")
        }

        fn visit_u64<E>(self, value: u64) -> Result<bool, E>
        where
            E: de::Error,
        {
            match value {
                0 => Ok(false),
                1 => Ok(true),
                _ => Err(E::custom("integer value for bool must be 0 or 1")),
            }
        }
    }

    deserializer.deserialize_any(IntVisitor)
}

#[allow(clippy::dbg_macro)]
#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::prelude::FromPrimitive;
    use rust_decimal::prelude::Zero;
    use rust_decimal_macros::dec;
    use serde_json::Value;
    use std::env;
    use std::fs;
    use std::path::Path;

    #[derive(Debug, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct SimulateCardTransactionRequest {
        transaction_amount: u64,
        transaction_currency: String,
        transaction_type: String,
        merchant_name: String,
        merchant_country_code: String,
        original_transaction_id: String,
    }

    #[allow(dead_code)]
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SimulateCardTransactionResponse {
        response: String,
        decline_type: Option<String>,
        decline_message: Option<String>,
        transaction_id: Uuid,
    }

    impl MoonCardClient {
        async fn simulate_card_transaction(
            &self,
            card_id: Uuid,
            usd_amount: u64,
            transaction_currency: String,
            transaction_type: String,
            transaction_id: Option<String>,
        ) -> Result<Value, reqwest::Error> {
            let url = format!("{}/card/{}/transactions", self.base_url, card_id);

            let merchant_name = "Test Merchant".to_string();
            let merchant_country_code = "USA".to_string();
            let original_transaction_id = transaction_id.unwrap_or_default();
            let body = SimulateCardTransactionRequest {
                transaction_amount: usd_amount,
                transaction_currency,
                transaction_type,
                merchant_name,
                merchant_country_code,
                original_transaction_id,
            };

            let res = self
                .client
                .post(&url)
                .header("x-api-key", &self.api_key)
                .json(&body)
                .send()
                .await?
                .json::<Value>()
                .await?;

            Ok(res)
        }
    }

    /// Helper function to get the API URL from the `.env` file.
    fn get_api_url() -> String {
        let env_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        env::var("MOON_API_URL").expect("need an API URL")
    }

    /// Helper function to get the API key from the `.env` file.
    fn get_api_key() -> String {
        let env_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        env::var("MOON_API_KEY").expect("need an API key")
    }

    /// Helper function to get a webhook url from the `.env` file.
    fn get_webook_url() -> String {
        let env_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        env::var("MOON_WEBHOOK_URL").expect("need webhook url")
    }

    #[ignore]
    #[tokio::test]
    async fn create_and_get_card() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());

        // In practice, it doesn't make a difference if you use a valid card product ID or not, but
        // let's try to do it properly and test the card products API in the process.
        let products = client.get_card_products().await.unwrap();
        let card_product_id = products.card_products[0].id;

        let response = client
            .create_card("test_customer_123", &card_product_id.to_string())
            .await
            .unwrap();

        let card = response.card;

        assert!(!card.id.is_nil());
        assert!(card.balance.is_zero());
        assert!(!card.display_expiration.is_empty());
        assert!(!card.terminated);
        assert!(!card.card_product_id.is_nil());
        assert!(!card.pan.is_empty());
        assert!(!card.cvv.is_empty());
        assert!(!card.support_token.is_empty());
        assert!(!card.frozen);

        let retrieved_card = client.get_card(card.id).await.unwrap();

        assert_eq!(card.id, retrieved_card.id);
        assert_eq!(card.balance, retrieved_card.balance);
        // we are comparing date only because the milliseconds see to differ
        assert_eq!(card.display_expiration, retrieved_card.display_expiration);
        assert_eq!(card.terminated, retrieved_card.terminated);
        assert_eq!(card.pan, retrieved_card.pan);
        assert_eq!(card.cvv, retrieved_card.cvv);
        assert_eq!(card.support_token, retrieved_card.support_token);
        assert_eq!(card.frozen, retrieved_card.frozen);

        assert_eq!(retrieved_card.card_product_id, card_product_id);
    }

    #[ignore]
    #[tokio::test]
    async fn add_balance_to_card() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());

        let products = client.get_card_products().await.unwrap();
        let card_product_id = products.card_products[0].id;

        let card = client
            .create_card("test_customer_123", &card_product_id.to_string())
            .await
            .unwrap();

        let amount = dec!(100.0);
        let topped_up_card = client.add_balance(card.card.id, amount).await.unwrap();

        assert_eq!(topped_up_card.balance, amount);
        assert_eq!(topped_up_card.available_balance, amount);
    }

    #[ignore]
    #[tokio::test]
    async fn freeze_and_thaw_card() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());

        let products = client.get_card_products().await.unwrap();
        let card_product_id = products.card_products[0].id;

        let response = client
            .create_card("test_customer_123", &card_product_id.to_string())
            .await
            .unwrap();

        let card = response.card;

        client.freeze_card(card.id, true).await.unwrap();

        let frozen_card = client.get_card(card.id).await.unwrap();

        assert!(frozen_card.frozen);

        client.freeze_card(card.id, false).await.unwrap();

        let thawed_card = client.get_card(card.id).await.unwrap();

        assert!(!thawed_card.frozen);
    }

    #[ignore]
    #[tokio::test]
    async fn test_generate_invoice() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());

        let usd_amount = dec!(50.0);
        let invoice = client
            .generate_invoice(usd_amount, Blockchain::Polygon, Currency::Usdc)
            .await
            .unwrap();

        assert!(!invoice.address.is_empty());
        assert_eq!(invoice.usd_amount_owed, usd_amount);
        assert_eq!(invoice.crypto_amount_owed, usd_amount);
        assert_eq!(invoice.blockchain, Blockchain::Polygon);
        assert_eq!(invoice.currency, Currency::Usdc);

        // Can be ignored for USDC.
        assert!(!invoice
            .exchange_rate_lock_expiration
            .unix_timestamp()
            .is_zero());
    }

    #[ignore]
    #[tokio::test]
    async fn test_get_card_transactions() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());
        client.delete_webhook().await.unwrap();
        client.register_webhook().await.unwrap();

        let products = client.get_card_products().await.unwrap();
        let card_product_id = products.card_products[0].id;

        let response = client
            .create_card("test_customer_123", &card_product_id.to_string())
            .await
            .unwrap();

        let card_id = response.card.id;

        let transactions = client.get_card_transactions(card_id, 1, 10).await.unwrap();
        assert!(transactions.is_empty());

        client.add_balance(card_id, dec!(1000.0)).await.unwrap();

        let tx_amount = 10;
        let tx_response = client
            .simulate_card_transaction(
                card_id,
                tx_amount,
                "USD".to_string(),
                "AUTHORIZATION".to_string(),
                None,
            )
            .await
            .unwrap();

        let tx_response: SimulateCardTransactionResponse =
            serde_json::from_value(tx_response).expect("to be able to parse");

        let transaction_id = Some(tx_response.transaction_id.to_string());
        client
            .simulate_card_transaction(
                card_id,
                2,
                "USD".to_string(),
                "REVERSAL".to_string(),
                transaction_id.clone(),
            )
            .await
            .unwrap();

        let final_tx_amount = 8;
        client
            .simulate_card_transaction(
                card_id,
                final_tx_amount,
                "USD".to_string(),
                "CLEARING".to_string(),
                transaction_id.clone(),
            )
            .await
            .unwrap();

        client
            .simulate_card_transaction(
                card_id,
                final_tx_amount,
                "USD".to_string(),
                "REFUND".to_string(),
                transaction_id.clone(),
            )
            .await
            .unwrap();

        let transactions = client.get_card_transactions(card_id, 1, 10).await.unwrap();
        assert_eq!(transactions.len(), 3);

        let transaction = transactions.first().unwrap();
        match transaction {
            Transaction::CardTransaction(data) | Transaction::CardAuthorizationRefund(data) => {
                assert_eq!(
                    data.amount,
                    Decimal::from_u64(final_tx_amount).expect("to fit")
                );
                assert_eq!(data.transaction_status, TransactionStatus::Settled);
            }
            Transaction::DeclineData(_) => {
                unreachable!("Not expected");
            }
        }
    }

    #[ignore]
    #[tokio::test]
    async fn test_get_moon_reserve_balance() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());

        let balance = client.get_moon_reserve_balance().await.unwrap();

        assert!(!balance.balance.is_zero());
        dbg!(balance);
    }

    #[test]
    fn deserialize_json_to_transaction() {
        let string = r#"{
          "data": {
            "amount": 8,
            "amountFeesInLedgerCurrency": 1,
            "amountFeesInTransactionCurrency": 1,
            "amountInTransactionCurrency": 8,
            "card": {
              "name": "My Moon 1X Visa® Card",
              "public_id": "11902a69-3fa4-415c-8573-4a607e14ccf3",
              "type": "Reloadable Moon 1X Visa® Card"
            },
            "datetime": "2024-11-14 10:26:24",
            "fees": [
              {
                "amount": 1,
                "feeDescription": "A 1.00% fee (minimum of $1.00) is charged on all transactions",
                "type": "TRANSACTION_FEE"
              }
            ],
            "ledgerCurrency": "USD",
            "merchant": "Test Merchant",
            "transactionCurrency": "USD",
            "transactionId": "f9028782-46a2-47ef-b75e-f4c90c598262",
            "transactionStatus": "SETTLED"
          },
          "type": "CARD_TRANSACTION"
        }"#;

        let _tx: Transaction = serde_json::from_str(string).unwrap();
    }

    #[test]
    pub fn deserialize_invoice() {
        let json = r#"{
            "id": "16b1983f-55c7-4b4e-84df-2018bb1a5544",
            "address": "0x4D336DD746c41e487779faCF0b8cA3b7415A236e",
            "usdAmountOwed": "10.00",
            "cryptoAmountOwed": "10.00000000",
            "exchangeRateLockExpiration": 1732413625675,
            "blockchain": "POLYGON",
            "currency": "USDC"
        }
        "#;

        let _invoice: Invoice = serde_json::from_str(json).unwrap();
    }

    #[test]
    pub fn deserialize_card_response() {
        let json = r#"{
              "id": "cb8d450e-b10d-402a-92a6-28e31674fd3c",
              "balance": "100.00",
              "expiration": "2025-01-31",
              "display_expiration": "01/25",
              "available_balance": "100.00",
              "terminated": 0,
              "card_product_id": "4a667032-c31a-434d-b1da-d2e88f9a2ec7",
              "pan": "4513650021034362",
              "cvv": "024",
              "support_token": "b632604bb9",
              "frozen": 0,
              "gift_card_info": {
                "barcode": null,
                "pin": null,
                "securityCode": null,
                "merchant_card_website": null
              }
            }
            "#;

        let _card_response: GetCardResponse = serde_json::from_str(json).unwrap();
    }

    #[test]
    pub fn deserialize_transaction_response() {
        let path = Path::new("tests/json_files/card_transactions.json");
        let file_contents =
            fs::read_to_string(path).unwrap_or_else(|_| panic!("Unable to read file: {:?}", path));

        let result: Result<TransactionResponse, _> = serde_json::from_str(&file_contents);
        assert!(
            result.is_ok(),
            "Failed to deserialize JSON file: {:?}. Error: {:?}",
            path,
            result.unwrap_err()
        );
    }

    #[test]
    fn test_deserialize_json_files() {
        // Specify the directory containing your JSON files
        let json_dir = Path::new("tests/json_files");

        // Ensure the directory exists
        assert!(json_dir.is_dir(), "Test JSON directory does not exist");

        // Read all files in the directory
        for entry in fs::read_dir(json_dir).expect("Failed to read directory") {
            let entry = entry.expect("Failed to get directory entry");
            let path = entry.path();

            // Skip non-JSON files
            if path.extension().map_or(false, |ext| ext != "json") {
                continue;
            }

            // Read file contents
            let file_contents = fs::read_to_string(&path)
                .unwrap_or_else(|_| panic!("Unable to read file: {:?}", path));

            // Attempt to deserialize
            let result: Result<MoonMessage, _> = serde_json::from_str(&file_contents);

            // Assert deserialization is successful
            assert!(
                result.is_ok(),
                "Failed to deserialize JSON file: {:?}. Error: {:?}",
                path,
                result.unwrap_err()
            );
        }
    }
}
