use esplora_client::RETRYABLE_ERROR_CODES;
use reqwest::Response;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

/// Base backoff in milliseconds.
const BASE_BACKOFF_MILLIS: Duration = Duration::from_millis(256);
/// Default max retries.
const DEFAULT_MAX_RETRIES: usize = 6;

#[derive(Debug, Error)]
pub enum MempoolClientError {
    #[error("Esplora client error: {0}")]
    Esplora(#[from] esplora_client::Error),
    #[error("Request failed: {0}")]
    Request(String),
    #[error("Failed to parse response: {0}")]
    Parse(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MempoolUtxo {
    pub txid: bitcoin::Txid,
    pub vout: u32,
    pub status: MempoolUtxoStatus,
    pub value: bitcoin::Amount,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MempoolUtxoStatus {
    pub confirmed: bool,
    pub block_height: Option<u32>,
    pub block_hash: Option<bitcoin::BlockHash>,
    pub block_time: Option<u32>,
}

pub struct MempoolClient {
    client: esplora_client::AsyncClient,
    url: String,
}

impl MempoolClient {
    pub fn new(url: &str) -> Result<Self, MempoolClientError> {
        let builder = esplora_client::Builder::new(url);
        let client = builder.build_async().map_err(MempoolClientError::Esplora)?;
        Ok(Self {
            client,
            url: url.to_owned(),
        })
    }

    pub async fn get_mempool_utxos(
        &self,
        address: &bitcoin::Address,
    ) -> Result<Vec<MempoolUtxo>, MempoolClientError> {
        let endpoint = format!("{}/address/{}/utxo", self.url, address);

        let response = self.get_with_retry(&endpoint).await?;

        if !response.status().is_success() {
            return Err(MempoolClientError::Request(format!(
                "Failed to get mempool utxos. Status {}, message: {:?}",
                response.status(),
                response.text().await
            )));
        }

        let utxos = response
            .json::<Vec<MempoolUtxo>>()
            .await
            .map_err(|e| MempoolClientError::Parse(e.to_string()))?;

        Ok(utxos)
    }

    async fn get_with_retry(&self, url: &str) -> Result<Response, esplora_client::Error> {
        let mut delay = BASE_BACKOFF_MILLIS;
        let mut attempts = 0;

        let client = self.client.client();

        loop {
            match client.get(url).send().await? {
                resp if attempts < DEFAULT_MAX_RETRIES && is_status_retryable(resp.status()) => {
                    tokio::time::sleep(delay).await;
                    attempts += 1;
                    delay *= 2;
                }
                resp => return Ok(resp),
            }
        }
    }
}

fn is_status_retryable(status: reqwest::StatusCode) -> bool {
    RETRYABLE_ERROR_CODES.contains(&status.as_u16())
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::str::FromStr;

    #[tokio::test]
    async fn test_mempool_client() {
        let client = MempoolClient::new("https://mempool.space/api").unwrap();

        let address = bitcoin::Address::from_str(
            "bc1p6j4rtqg7fmqcuhr03rw7a4dkasgyrj9cmeyggemxy5jplm6q860safmdn4",
        )
        .unwrap()
        .assume_checked();
        match client.get_mempool_utxos(&address).await {
            Ok(utxos) => {
                let total_value = utxos.iter().map(|utxo| utxo.value).sum::<bitcoin::Amount>();
                println!("Total value for address {:?}", total_value);
                println!("Found {} UTXOs", utxos.len());
            }
            Err(e) => eprintln!("Failed to get UTXOs: {}", e),
        }
    }
}
