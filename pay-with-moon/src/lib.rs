use reqwest::Client;
use rust_decimal::Decimal;
use serde::de;
use serde::de::Visitor;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use std::fmt;
use time::OffsetDateTime;
use uuid::Uuid;

// Production API URL: https://api.paywithmoon.com/v1/api-gateway
// Mocked API URL: https://virtserver.swaggerhub.com/Moon6/Moon-card-issuing/1.0.6/v1/api-gateway
// Staging API URL: https://stagingapi.paywithmoon.com/v1/api-gateway

#[derive(Debug, Deserialize)]
pub struct CreateCardResponse {
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
    /// Indicates if the card has been terminated (deleted).
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
    /// The expiration date of the card. Date format in `[year]-[month]-[day]`, e.g. `2024-11-01`.
    ///
    /// We can't use `#[serde(with = "time::serde::iso8601")]`, because we are missing data.
    pub expiration: String,
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

#[derive(Debug, Deserialize, PartialEq)]
pub enum CardTransactionType {
    #[serde(rename = "CARD_TRANSACTION")]
    CardTransaction,
    #[serde(untagged)]
    Unknown(String),
}

#[derive(Debug, Deserialize)]
pub struct Transaction {
    #[serde(rename = "type")]
    pub transaction_type: CardTransactionType,
    pub data: TransactionData,
}

#[derive(Debug, Deserialize, PartialEq)]
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
    #[serde(untagged)]
    Unknown(String),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionData {
    pub card: TransactionCard,
    pub transaction_id: Uuid,
    pub transaction_status: TransactionStatus,
    #[serde(with = "time::serde::iso8601")]
    pub datetime: OffsetDateTime,
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

#[derive(Debug, Deserialize)]
pub struct TransactionCard {
    pub public_id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub card_type: String,
}

#[derive(Debug, Deserialize)]
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
    pub id: u64,
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

#[derive(Debug, Deserialize)]
pub struct InvoicePayment {
    pub id: u64,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    #[serde(rename = "createdAt")]
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
    ) -> Result<CreateCardResponse, reqwest::Error> {
        let url = format!("{}/card", self.base_url);

        // TODO: Figure out how we can use the `end_customer_id`.
        let body = serde_json::json!({ "end_customer_id": end_customer_id });

        let card = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .header("card_product_id", card_product_id)
            .json(&body)
            .send()
            .await?
            .json::<CreateCardResponse>()
            .await?;

        Ok(card)
    }

    pub async fn get_card(&self, card_id: Uuid) -> Result<GetCardResponse, reqwest::Error> {
        let url = format!("{}/card/{}", self.base_url, card_id);

        self.client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .json::<GetCardResponse>()
            .await
    }

    pub async fn add_balance(
        &self,
        card_id: Uuid,
        amount: Decimal,
    ) -> Result<AddBalanceResponse, reqwest::Error> {
        let url = format!("{}/card/{}/add_balance", self.base_url, card_id);
        let body = serde_json::json!({ "amount": amount.to_string() });

        self.client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .json::<AddBalanceResponse>()
            .await
    }

    pub async fn freeze_card(
        &self,
        card_id: Uuid,
        frozen: bool,
    ) -> Result<FreezeResponse, reqwest::Error> {
        let url = format!("{}/card/{}/freeze", self.base_url, card_id);
        let body = serde_json::json!({ "frozen": frozen });

        self.client
            .patch(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .json::<FreezeResponse>()
            .await
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

        let txs = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .json::<TransactionResponse>()
            .await?
            .transactions;
        Ok(txs)
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

        let invoice = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .json(&body)
            .send()
            .await?
            .json::<InvoiceResponse>()
            .await?
            .invoice;

        Ok(invoice)
    }

    pub async fn get_moon_reserve_balance(&self) -> Result<Balance, reqwest::Error> {
        let url = format!("{}/moon-reserve", self.base_url);

        self.client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .json::<Balance>()
            .await
    }

    pub async fn get_card_products(&self) -> Result<CardProducts, reqwest::Error> {
        let url = format!("{}/card-products", self.base_url);

        self.client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?
            .json::<CardProducts>()
            .await
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
    use rust_decimal::prelude::Zero;
    use rust_decimal_macros::dec;
    use serde_json::Value;
    use std::env;

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

        let card = client
            .create_card("test_customer_123", &card_product_id.to_string())
            .await
            .unwrap();

        assert!(!card.id.is_nil());
        assert!(card.balance.is_zero());
        assert!(card.available_balance.is_zero());
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
        assert_eq!(card.available_balance, retrieved_card.available_balance);
        assert_eq!(card.expiration, retrieved_card.expiration);
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
        let topped_up_card = client.add_balance(card.id, amount).await.unwrap();

        assert_eq!(topped_up_card.balance, amount);
        assert_eq!(topped_up_card.available_balance, amount);
    }

    #[ignore]
    #[tokio::test]
    async fn freeze_and_thaw_card() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());

        let products = client.get_card_products().await.unwrap();
        let card_product_id = products.card_products[0].id;

        let card = client
            .create_card("test_customer_123", &card_product_id.to_string())
            .await
            .unwrap();

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

        let products = client.get_card_products().await.unwrap();
        let card_product_id = products.card_products[0].id;

        let card = client
            .create_card("test_customer_123", &card_product_id.to_string())
            .await
            .unwrap();

        let card_id = card.id;

        let transactions = client.get_card_transactions(card_id, 1, 10).await.unwrap();
        assert!(transactions.is_empty());

        client.add_balance(card_id, dec!(1000.0)).await.unwrap();

        let tx_amount = 10;
        client
            .simulate_card_transaction(
                card_id,
                tx_amount,
                "USD".to_string(),
                "AUTHORIZATION".to_string(),
                None,
            )
            .await
            .unwrap();

        let transactions = client.get_card_transactions(card_id, 1, 10).await.unwrap();
        assert_eq!(transactions.len(), 1);

        assert_eq!(
            transactions[0].transaction_type,
            CardTransactionType::CardTransaction
        );
        assert_eq!(transactions[0].data.amount, tx_amount.into());
        assert_eq!(
            transactions[0].data.transaction_status,
            TransactionStatus::Pending
        );
    }

    #[ignore]
    #[tokio::test]
    async fn test_get_moon_reserve_balance() {
        let client = MoonCardClient::new(get_api_key(), get_api_url(), get_webook_url());

        let balance = client.get_moon_reserve_balance().await.unwrap();

        assert!(!balance.balance.is_zero());
        dbg!(balance);
    }
}
