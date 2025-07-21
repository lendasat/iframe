use anyhow::bail;
use anyhow::Result;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::fmt;

#[derive(Clone, Copy)]
pub enum PolygonNetwork {
    Polygon,
    Amoy,
}

impl PolygonNetwork {
    fn chain_id(&self) -> u32 {
        match self {
            PolygonNetwork::Polygon => 137,
            PolygonNetwork::Amoy => 80002,
        }
    }

    /// Get the token associated with the [`PolygonNetwork`].
    ///
    /// This tool only supports one token for now. Since it's really hard to get USDC on Polygon
    /// Amoy, we use ChainLink tokens instead.
    fn token(&self) -> Token {
        match self {
            PolygonNetwork::Polygon => Token::Usdc,
            PolygonNetwork::Amoy => Token::ChainLink,
        }
    }
}

enum Token {
    Usdc,
    // Used for testing on Polygon Amoy.
    ChainLink,
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Token::Usdc => write!(f, "Usdc"),
            Token::ChainLink => write!(f, "ChainLink"),
        }
    }
}

impl Token {
    fn contract_address(&self) -> &str {
        match self {
            // The contract address on Polygon.
            Token::Usdc => "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
            // The contract address on Polygon Amoy.
            Token::ChainLink => "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
        }
    }

    fn decimal_places(&self) -> u8 {
        match self {
            Token::Usdc => 18,
            Token::ChainLink => 18,
        }
    }
}

#[derive(Debug, PartialEq, Clone)]
pub enum PaymentStatus {
    Confirmed,
    NotFound,
    Insufficient,
}

#[derive(Debug, Clone)]
pub struct Client {
    client: reqwest::Client,
    base_url: String,
    api_key: String,
}

impl Client {
    pub fn new(api_key: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "https://api.etherscan.io".to_string(),
            api_key,
        }
    }

    pub async fn verify_payment(
        &self,
        network: PolygonNetwork,
        address: &str,
        txid: &str,
        expected_amount: Decimal,
    ) -> Result<PaymentStatus> {
        let token = network.token();

        // Get token transfers for the payment transaction
        let transfers = self
            .get_token_transfers(network.chain_id(), token.contract_address(), address)
            .await?;

        // Look for a transaction that matches the payment_id and expected amount
        for transfer in &transfers {
            if transfer.hash == txid {
                // Convert the transfer value to the same units as expected_amount
                let transfer_value = transfer.value.parse::<u128>()?;
                let divisor = Decimal::from(10u128.pow(token.decimal_places() as u32));
                let transfer_amount = Decimal::from(transfer_value) / divisor;

                // Round both amounts to the nearest cent (2 decimal places) for comparison
                let transfer_amount_rounded = transfer_amount.round_dp(2);
                let expected_amount_rounded = expected_amount.round_dp(2);

                if transfer_amount_rounded >= expected_amount_rounded {
                    tracing::info!(
                        %txid,
                        "Payment verified: got {transfer_amount} \
                         (rounded: {transfer_amount_rounded}) {token}",
                    );
                    return Ok(PaymentStatus::Confirmed);
                } else {
                    tracing::warn!(
                        %txid,
                        "Payment insufficient: expected {expected_amount} \
                         (rounded: {expected_amount_rounded}), got {transfer_amount} \
                         (rounded: {transfer_amount_rounded})",
                    );
                    return Ok(PaymentStatus::Insufficient);
                }
            }
        }

        tracing::warn!(
            %txid,
            "Payment verification failed: no token transfer found",
        );

        Ok(PaymentStatus::NotFound)
    }

    async fn get_token_transfers(
        &self,
        chain_id: u32,
        contract_address: &str,
        address: &str,
    ) -> Result<Vec<TokenTransfer>> {
        let url = format!(
            "{}/v2/api?\
             chainid={}&module=account&action=tokentx\
             &contractaddress={}&address={}&page=1&offset=100\
             &sort=desc&apikey={}",
            self.base_url, chain_id, contract_address, address, self.api_key
        );

        let response = self.client.get(&url).send().await?;
        let tx_response: EtherscanTransactionResponse = response.json().await?;

        if tx_response.status != "1" {
            bail!("Etherscan API error: {}", tx_response.message);
        }

        Ok(tx_response.result)
    }
}

#[derive(Debug, Deserialize)]
struct EtherscanTransactionResponse {
    status: String,
    message: String,
    result: Vec<TokenTransfer>,
}

#[derive(Debug, Deserialize, Clone)]
struct TokenTransfer {
    pub hash: String,
    pub value: String,
}
