use reqwest::Client;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::fmt;
use thiserror::Error;
use time::OffsetDateTime;
use uuid::Uuid;

const STABLE_COIN_DECIMALS: u32 = 6;

// Production API URL: https://docs.sideshift.ai/endpoints/v2/coins

#[derive(Deserialize, Debug)]
pub struct ErrorWrapper {
    error: ErrorDetail,
}

#[derive(Deserialize, Debug)]
pub struct ErrorDetail {
    message: String,
}

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("{0}")]
    Api(String),
    #[error("Request failed: {0}")]
    Request(#[from] reqwest::Error),
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "UPPERCASE")]
pub enum Coin {
    Usdc,
    Usdt,
    Btc,
}

impl fmt::Display for Coin {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Coin::Usdc => {
                write!(f, "usdc")
            }
            Coin::Usdt => {
                write!(f, "usdt")
            }
            Coin::Btc => {
                write!(f, "btc")
            }
        }
    }
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum BitcoinNetwork {
    Bitcoin,
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum EthereumNetwork {
    /// Ethereum main chain
    Ethereum,
    Polygon,
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum SolanaNetwork {
    Solana,
}
#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum LiquidNetwork {
    Liquid,
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(untagged)]
pub enum Network {
    Ethereum(EthereumNetwork),
    Bitcoin(BitcoinNetwork),
    Solana(SolanaNetwork),
    Liquid(LiquidNetwork),
}

impl fmt::Display for Network {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Network::Ethereum(EthereumNetwork::Ethereum) => {
                write!(f, "ethereum")
            }
            Network::Bitcoin(BitcoinNetwork::Bitcoin) => {
                write!(f, "bitcoin")
            }
            Network::Ethereum(EthereumNetwork::Polygon) => {
                write!(f, "polygon")
            }
            Network::Solana(SolanaNetwork::Solana) => {
                write!(f, "solana")
            }
            Network::Liquid(LiquidNetwork::Liquid) => {
                write!(f, "liquid")
            }
        }
    }
}

#[derive(Clone)]
pub struct SideShiftClient {
    secret: String,
    affiliate_id: String,
    base_url: String,
    commission_rate: Option<Decimal>,
    client: Client,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pair {
    #[serde(with = "rust_decimal::serde::str")]
    pub min: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub max: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub rate: Decimal,
    pub deposit_coin: Coin,
    pub settle_coin: Coin,
    pub deposit_network: Network,
    pub settle_network: Network,
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ShiftKind {
    /// A fixed rate shift
    ///
    /// The rate is usually valid for 15 minutes
    Fixed,

    /// A variable shift
    ///
    /// The user will get the rate once the deposit transaction has been confirmed
    Variable,
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum ShiftStatus {
    /// Waiting for deposit
    ///
    /// No deposit detected for the shift
    Waiting,
    /// Detected
    ///
    /// SideShift.ai's has detected the deposit and is waiting for 1 block confirmation
    /// for majority of the coins and 2 confirmations for Litecoin, Dash, Doge. The rate is
    /// locked-in
    Pending,
    /// Confirmed
    ///
    /// The deposit has been confirmed in the blockchain and is being processed by
    /// SideShift.ai
    Processing,
    /// Under human review
    ///
    /// The deposit cannot be automatically processed. After human review it can
    /// be settled or refunded.
    Review,
    /// Settlement in progress
    ///
    /// SideShift.ai has created the transaction which settles the deposit
    /// and it's waiting for 1 confirmation.
    Settling,
    /// Settlement completed
    ///
    /// Settlement transaction has received 1 block confirmation
    Settled,
    /// Queued for refund
    ///
    /// User is required to enter a refund address on https://sideshift.ai/orders/SHIFT_ID or
    /// via the /refund-address endpoint, unless pre-defined in one of the /shifts endpoints.
    Refund,
    /// Refund in progress
    ///
    /// Refund transaction created, waiting for 1 confirmation into the blockchain.
    Refunding,
    /// Refund completed
    ///
    /// Refund transaction has received 1 block confirmation.
    Refunded,
    /// Shift expired
    ///
    /// The created shift has reached the end of its validity period without
    /// receiving any deposits.
    Expired,
    /// Multiple deposits detected
    ///
    /// Use the deposits array in the endpoint response for data about
    /// each deposit
    Multiple,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Quote {
    pub id: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    pub deposit_coin: Coin,
    pub deposit_network: Network,
    pub settle_coin: Coin,
    pub settle_network: Network,
    #[serde(with = "time::serde::rfc3339")]
    pub expires_at: OffsetDateTime,
    #[serde(with = "rust_decimal::serde::str")]
    pub deposit_amount: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub settle_amount: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub rate: Decimal,
    pub affiliate_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedShift {
    pub id: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    pub deposit_coin: Coin,
    pub deposit_network: Network,
    pub settle_coin: Coin,
    pub settle_network: Network,
    pub deposit_address: String,
    pub settle_address: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub deposit_min: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub deposit_max: Decimal,
    pub refund_address: String,
    #[serde(rename = "type")]
    pub kind: ShiftKind,
    pub quote_id: Uuid,
    #[serde(with = "rust_decimal::serde::str")]
    pub deposit_amount: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub settle_amount: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub expires_at: OffsetDateTime,
    pub status: ShiftStatus,
    #[serde(with = "rust_decimal::serde::str")]
    pub average_shift_seconds: Decimal,
    pub external_id: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub rate: Decimal,
}

/// Represents the status of a shift.
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FixedShiftStatus {
    pub id: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    pub deposit_coin: Coin,
    pub deposit_network: Network,
    pub settle_coin: Coin,
    pub settle_network: Network,
    pub deposit_address: String,
    pub settle_address: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub deposit_min: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub deposit_max: Decimal,
    pub refund_address: String,
    #[serde(rename = "type")]
    pub kind: ShiftKind,
    pub quote_id: Uuid,
    #[serde(with = "rust_decimal::serde::str")]
    pub deposit_amount: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub settle_amount: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub expires_at: OffsetDateTime,
    pub status: ShiftStatus,
    #[serde(with = "rust_decimal::serde::str")]
    pub average_shift_seconds: Decimal,
    pub external_id: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub rate: Decimal,
    #[serde(
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option",
        default
    )]
    pub updated_at: Option<OffsetDateTime>,
    pub deposit_hash: Option<String>,
    pub settle_hash: Option<String>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option",
        default
    )]
    pub deposit_received_at: Option<OffsetDateTime>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        with = "rust_decimal::serde::str_option",
        default
    )]
    pub settle_coin_network_fee: Option<Decimal>,
    pub issue: Option<String>,
}

impl SideShiftClient {
    /// Creates a new SideShift.Ai client.
    ///
    /// commission_rate (expressed in percent, i.e. 0.005 is 0.5%) will reduce the commission paid
    /// by SideShift to us in XAI. We don't care about XAI, hence this should mostly be 0,
    /// nevertheless, we expose this in case we ever want to configure it.
    pub fn new(
        secret: String,
        base_url: String,
        affiliate_id: String,
        commission_rate: Option<Decimal>,
    ) -> Self {
        Self {
            client: Client::new(),
            secret,
            affiliate_id,
            base_url,
            commission_rate,
        }
    }

    /// Returns the minimum and maximum deposit amount and the rate for a pair of coins.
    ///
    /// from and to can be coin-network or if network is omitted, it will default to the mainnet.
    /// E.g eth-ethereum, eth-mainnet or eth all refer to ETH on the Ethereum network. eth-arbitrum
    /// refers to ETH on Arbitrum network.
    //
    /// The rate is determined after incorporating network fees. Without specifying an amount, the
    /// system will assume a deposit value of 500 USD. This can be adjusted by adding the amount
    /// query parameter.
    ///
    /// https://docs.sideshift.ai/endpoints/v2/pair
    pub async fn get_pair(
        &self,
        from_coin: Coin,
        to_coin: Coin,
        from_network: Network,
        to_network: Network,
        amount: Option<Decimal>,
    ) -> Result<Pair, reqwest::Error> {
        let url = format!(
            "{}/pair/{}-{}/{}-{}",
            self.base_url, from_coin, from_network, to_coin, to_network
        );

        let url = match amount {
            None => url,
            Some(amount) => {
                format!("{url}?amount={amount}")
            }
        };

        let response = self.client.get(&url).send().await?.error_for_status();

        match response {
            Ok(response) => response.json::<Pair>().await,
            Err(error) => {
                tracing::error!("Failed at creating getting pair and quote {error}");
                Err(error)
            }
        }
    }

    /// For fixed rate shifts, a quote should be requested first.
    ///
    /// A quote can be requested for either a depositAmount or a settleAmount.
    ///
    /// When defining non-native tokens like AXS and USDT for depositCoin and/or settleCoin, the
    /// depositNetwork and settleNetwork fields must also be specified. This also applies to native
    /// tokens like ETH that supports multiple networks.
    ///
    /// commissionRate optional parameter can be used to offer a better rate for your users by
    /// reducing the affiliate commission paid by SideShift.
    ///
    /// If the API requests are sent from the integrations own server, the x-user-ip header must be
    /// set to the end-user IP address. Otherwise the requests will be blocked. See Permissions.
    ///
    /// After the quote request, a fixed rate shift should be created using the `id` returned by the
    /// /quotes endpoint.
    ///
    /// A quote expires after 15 minutes.
    ///
    /// https://docs.sideshift.ai/endpoints/v2/requestquote
    #[allow(clippy::too_many_arguments)]
    pub async fn get_quote(
        &self,
        from_coin: Coin,
        to_coin: Coin,
        from_network: Network,
        to_network: Network,
        user_ip: String,
        deposit_amount: Option<Decimal>,
        settle_amount: Option<Decimal>,
    ) -> Result<Quote, ApiError> {
        let url = format!("{}/quotes", self.base_url);

        let settle_amount = if let Coin::Usdc | Coin::Usdt = to_coin {
            settle_amount.map(|settle_amount| settle_amount.round_dp(STABLE_COIN_DECIMALS))
        } else {
            settle_amount
        };

        #[derive(Deserialize, Serialize, Debug)]
        #[serde(rename_all = "camelCase")]
        struct RequestBody {
            deposit_coin: Coin,
            deposit_network: Network,
            settle_coin: Coin,
            settle_network: Network,
            #[serde(with = "rust_decimal::serde::str_option")]
            deposit_amount: Option<Decimal>,
            #[serde(with = "rust_decimal::serde::str_option")]
            settle_amount: Option<Decimal>,
            affiliate_id: String,
            #[serde(with = "rust_decimal::serde::str_option")]
            commission_rate: Option<Decimal>,
        }

        let body = RequestBody {
            deposit_coin: from_coin,
            deposit_network: from_network,
            settle_coin: to_coin,
            settle_network: to_network,
            deposit_amount,
            settle_amount,
            affiliate_id: self.affiliate_id.clone(),
            commission_rate: self.commission_rate,
        };

        tracing::trace!(?body, "Requesting quote");

        let response = self
            .client
            .post(&url)
            .header("x-sideshift-secret", &self.secret)
            .header("x-user-ip", &user_ip)
            .json(&body)
            .send()
            .await?;

        let status_code = response.status();
        if !status_code.is_success() {
            let error = response.json::<ErrorWrapper>().await?;
            tracing::error!(
                status_code = status_code.as_u16(),
                message = error.error.message,
                user_ip,
                "Failed at creating quote"
            );
            return Err(ApiError::Api(error.error.message));
        }

        Ok(response.json().await?)
    }

    /// Note: For fixed rate shifts, a quote should be requested first.
    ///
    /// After requesting a quote, use the quoteId to create a fixed rate shift with the quote. The
    /// affiliateId must match the one used to request the quote.
    ///
    /// For fixed rate shifts, a deposit of exactly the amount of depositAmount must be made before
    /// the expiresAt timestamp, otherwise the deposit will be refunded.
    ///
    /// For shifts that return a depositMemo, the deposit transaction must include this memo,
    /// otherwise the deposit might be lost.
    ///
    /// For shifts settling in coins where hasMemo is true in the /coins endpoint, API users are
    /// allowed to specify a settleMemo field, for example "settleMemo": "123343245".
    ///
    /// x-sideshift-secret header is required. It can be obtained from the account page under the
    /// account secret.
    ///
    /// refundAddress and refundMemo are optional, if not defined, user will be prompted to enter a
    /// refund address manually on the SideShift.ai order page if the shift needs to be refunded.
    ///
    /// https://docs.sideshift.ai/endpoints/v2/createfixedshift
    #[allow(clippy::too_many_arguments)]
    pub async fn create_fixed_shift(
        &self,
        settle_address: String,
        settle_memo: Option<String>,
        quote_id: Uuid,
        refund_address: Option<String>,
        refund_memo: Option<String>,
        external_id: Option<String>,
        user_ip: String,
    ) -> Result<FixedShift, ApiError> {
        let url = format!("{}/shifts/fixed", self.base_url);

        #[derive(Deserialize, Serialize)]
        #[serde(rename_all = "camelCase")]
        struct RequestBody {
            settle_address: String,
            settle_memo: Option<String>,
            affiliate_id: String,
            quote_id: Uuid,
            refund_address: Option<String>,
            refund_memo: Option<String>,
            external_id: Option<String>,
        }

        let body = RequestBody {
            settle_address,
            settle_memo,
            affiliate_id: self.affiliate_id.clone(),
            quote_id,
            refund_address,
            refund_memo,
            external_id,
        };

        let response = self
            .client
            .post(&url)
            .header("x-sideshift-secret", &self.secret)
            .header("x-user-ip", user_ip)
            .json(&body)
            .send()
            .await?;

        let status_code = response.status();
        if !status_code.is_success() {
            let error = response.json::<ErrorWrapper>().await?;
            tracing::error!(
                status_code = status_code.as_u16(),
                message = error.error.message,
                "Failed at creating fixed shift"
            );
            return Err(ApiError::Api(error.error.message));
        }

        Ok(response.json().await?)
    }

    /// Returns the shift data for a fixed shift
    ///
    /// Note:
    /// - This currently only supports fixed shifts, we do not support variable shifts yet
    /// - For shift that has multiple as status this has not been implemented!
    pub async fn get_fixed_shift(&self, shift_id: String) -> Result<FixedShiftStatus, ApiError> {
        let url = format!("{}/shifts/{}", self.base_url, shift_id);

        let response = self.client.get(&url).send().await?;

        let status_code = response.status();
        if !status_code.is_success() {
            let error = response.json::<ErrorWrapper>().await?;
            tracing::error!(
                status_code = status_code.as_u16(),
                message = error.error.message,
                "Failed at fetching shift status"
            );
            return Err(ApiError::Api(error.error.message));
        }

        Ok(response.json().await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    use std::env;
    use std::str::FromStr;

    /// Helper function to get the API URL from the `.env` file.
    fn get_api_url() -> String {
        let env_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        env::var("SIDESHIFT_API_BASE_URL").expect("need an API URL")
    }

    /// Helper function to get the api secret from the `.env` file.
    fn get_api_secret() -> String {
        let env_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        env::var("SIDESHIFT_SECRET").expect("need an API key")
    }

    /// Helper function to get a webhook url from the `.env` file.
    fn get_sideshift_affiliate_id() -> String {
        let env_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        env::var("SIDESHIFT_AFFILIATE_ID").expect("need webhook url")
    }

    /// Helper function to get a commission rate from the `.env` file.
    fn get_sideshift_commission_rate() -> Decimal {
        let env_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        let commission_rate = env::var("SIDESHIFT_COMMISSION_RATE").expect("need webhook url");
        Decimal::from_str(commission_rate.as_str()).unwrap()
    }

    #[ignore]
    #[tokio::test]
    async fn get_coins() {
        let client = SideShiftClient::new(
            get_api_secret(),
            get_api_url(),
            get_sideshift_affiliate_id(),
            None,
        );

        let _pair = client
            .get_pair(
                Coin::Usdc,
                Coin::Btc,
                Network::Ethereum(EthereumNetwork::Polygon),
                Network::Bitcoin(BitcoinNetwork::Bitcoin),
                Some(dec!(500)),
            )
            .await
            .unwrap();
    }

    #[ignore]
    #[tokio::test]
    async fn get_quote() {
        let affiliate_id = get_sideshift_affiliate_id();
        let client =
            SideShiftClient::new(get_api_secret(), get_api_url(), affiliate_id.clone(), None);

        let settle_amount = dec!(100);
        let quote = client
            .get_quote(
                Coin::Btc,
                Coin::Usdc,
                Network::Bitcoin(BitcoinNetwork::Bitcoin),
                Network::Ethereum(EthereumNetwork::Polygon),
                "144.6.200.190".to_string(),
                None,
                Some(settle_amount),
            )
            .await
            .unwrap();

        assert_eq!(quote.deposit_coin, Coin::Btc);
        assert_eq!(
            quote.deposit_network,
            Network::Bitcoin(BitcoinNetwork::Bitcoin)
        );
        assert_eq!(quote.settle_coin, Coin::Usdc);
        assert_eq!(
            quote.settle_network,
            Network::Ethereum(EthereumNetwork::Polygon)
        );
        assert_eq!(quote.settle_amount, settle_amount);
        assert_eq!(quote.affiliate_id, affiliate_id);
    }

    #[ignore]
    #[tokio::test]
    async fn get_quote_with_commission_rate() {
        let affiliate_id = get_sideshift_affiliate_id();
        let client = SideShiftClient::new(
            get_api_secret(),
            get_api_url(),
            affiliate_id.clone(),
            Some(get_sideshift_commission_rate()),
        );

        let settle_amount = dec!(1000);
        let quote = client
            .get_quote(
                Coin::Btc,
                Coin::Usdc,
                Network::Bitcoin(BitcoinNetwork::Bitcoin),
                Network::Ethereum(EthereumNetwork::Polygon),
                "144.6.207.190".to_string(),
                None,
                Some(settle_amount),
            )
            .await
            .unwrap();

        assert_eq!(quote.deposit_coin, Coin::Btc);
        assert_eq!(
            quote.deposit_network,
            Network::Bitcoin(BitcoinNetwork::Bitcoin)
        );
        assert_eq!(quote.settle_coin, Coin::Usdc);
        assert_eq!(
            quote.settle_network,
            Network::Ethereum(EthereumNetwork::Polygon)
        );
        assert_eq!(quote.settle_amount, settle_amount);
        assert_eq!(quote.affiliate_id, affiliate_id);
    }

    #[test]
    pub fn deserialize_quote_response() {
        let json = r#"{
              "id": "690b83bd-3fc9-4cc1-bf51-f030438ca9b6",
              "createdAt": "2024-12-23T03:49:22.873Z",
              "depositCoin": "USDC",
              "settleCoin": "BTC",
              "depositNetwork": "polygon",
              "settleNetwork": "bitcoin",
              "expiresAt": "2024-12-23T04:04:22.873Z",
              "depositAmount": "100",
              "settleAmount": "0.00100258",
              "rate": "0.0000100258",
              "affiliateId": "Abmk3E6usY"
            }"#;
        let _quote = serde_json::from_str::<Quote>(json).unwrap();
    }

    #[ignore]
    #[tokio::test]
    pub async fn test_create_fixed_shift() {
        let affiliate_id = get_sideshift_affiliate_id();
        let client =
            SideShiftClient::new(get_api_secret(), get_api_url(), affiliate_id.clone(), None);

        let settle_amount = dec!(1000);
        let quote = client
            .get_quote(
                Coin::Btc,
                Coin::Usdc,
                Network::Bitcoin(BitcoinNetwork::Bitcoin),
                Network::Ethereum(EthereumNetwork::Polygon),
                "144.6.200.190".to_string(),
                None,
                Some(settle_amount),
            )
            .await
            .unwrap();

        let shift = client
            .create_fixed_shift(
                "0x381b9456b340d65691bcaf090a052cfb11d22208".to_string(),
                None,
                quote.id,
                Some("bc1q5nfzu2cjh9a8jf26m5jtfyy0fq30z46x8lu7dt".to_string()),
                None,
                Some("simple-test".to_string()),
                "144.6.200.190".to_string(),
            )
            .await
            .unwrap();

        assert_eq!(quote.settle_coin, shift.settle_coin);
        assert_eq!(quote.settle_network, shift.settle_network);
        assert_eq!(quote.deposit_coin, shift.deposit_coin);
        assert_eq!(quote.deposit_network, shift.deposit_network);
        assert_eq!(quote.rate, shift.rate);
        assert_eq!(quote.settle_amount, shift.settle_amount);

        let fetched_shift = client.get_fixed_shift(shift.id.clone()).await.unwrap();

        assert_eq!(shift.id, fetched_shift.id);
    }

    #[test]
    pub fn serialize_to_shift_status() {
        let json = r#"{
              "id": "65e6d58bf0215e5ac513",
              "createdAt": "2024-12-23T06:01:34.314Z",
              "depositCoin": "BTC",
              "settleCoin": "USDC",
              "depositNetwork": "bitcoin",
              "settleNetwork": "polygon",
              "depositAddress": "3BkPYBFSfc18mqKzZoMVn2zJJEzkXaGHh2",
              "settleAddress": "0x381B9456B340D65691BCaf090a052CFb11d22208",
              "depositMin": "0.01066934",
              "depositMax": "0.01066934",
              "refundAddress": "bc1q5nfzu2cjh9a8jf26m5jtfyy0fq30z46x8lu7dt",
              "type": "fixed",
              "quoteId": "760cf335-0ea7-43c0-8631-936e60d8246f",
              "depositAmount": "0.01066934",
              "settleAmount": "1000",
              "expiresAt": "2024-12-23T06:16:33.498Z",
              "status": "waiting",
              "averageShiftSeconds": "20.308843",
              "externalId": "simple-test",
              "rate": "93726.509793483008"
            }"#;

        let _shift = serde_json::from_str::<FixedShiftStatus>(json).unwrap();
    }
}
