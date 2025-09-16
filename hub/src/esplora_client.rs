use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MempoolClientError {
    #[error("Esplora client error: {0}")]
    EsploraError(#[from] esplora_client::Error),
    #[error("Request failed: {0}")]
    RequestError(String),
    #[error("Failed to parse response: {0}")]
    ParseError(String),
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
    client: esplora_client::BlockingClient,
}

impl MempoolClient {
    pub fn new(url: &str) -> Self {
        let builder = esplora_client::Builder::new(url);
        let client = builder.build_blocking();
        Self { client }
    }

    pub fn default() -> Self {
        Self::new("https://mempool.space/api")
    }

    pub fn get_mempool_utxos(
        &self,
        address: &bitcoin::Address,
    ) -> Result<Vec<MempoolUtxo>, MempoolClientError> {
        let endpoint = format!("/address/{}/utxo", address);

        let response = self
            .client
            .get_request(&endpoint)
            .map_err(MempoolClientError::EsploraError)?
            .send()
            .map_err(|e| MempoolClientError::RequestError(e.to_string()))?;

        let utxos: Vec<MempoolUtxo> = response
            .json()
            .map_err(|e| MempoolClientError::ParseError(e.to_string()))?;

        Ok(utxos)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::str::FromStr;

    #[tokio::test]
    async fn test_mempool_client() {
        let client = MempoolClient::default();

        let address = bitcoin::Address::from_str(
            "bc1p6j4rtqg7fmqcuhr03rw7a4dkasgyrj9cmeyggemxy5jplm6q860safmdn4",
        )
        .unwrap()
        .assume_checked();
        match client.get_mempool_utxos(&address) {
            Ok(utxos) => {
                let total_value = utxos.iter().map(|utxo| utxo.value).sum::<bitcoin::Amount>();
                println!("Total value for address {:?}", total_value);
                println!("Found {} UTXOs", utxos.len());
            }
            Err(e) => eprintln!("Failed to get UTXOs: {}", e),
        }
    }
}
