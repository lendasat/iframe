use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EsploraClientError {
    #[error("Esplora client error: {0}")]
    Esplora(#[from] esplora_client::Error),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EsploraUtxo {
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

pub struct EsploraClient {
    client: esplora_client::AsyncClient,
}

impl EsploraClient {
    pub fn new(url: &str) -> Result<Self, EsploraClientError> {
        let builder = esplora_client::Builder::new(url);
        let client = builder.build_async().map_err(EsploraClientError::Esplora)?;
        Ok(Self { client })
    }

    pub async fn get_address_txes(
        &self,
        address: &bitcoin::Address,
        last_seen: Option<bitcoin::Txid>,
    ) -> Result<Vec<esplora_client::Tx>, EsploraClientError> {
        let txes = self
            .client
            .get_address_txs(address, last_seen)
            .await
            .map_err(EsploraClientError::Esplora)?;
        Ok(txes)
    }

    pub async fn get_block_tip_height(&self) -> Result<u32, EsploraClientError> {
        self.client
            .get_height()
            .await
            .map_err(EsploraClientError::Esplora)
    }

    pub async fn post_tx(&self, tx: &bitcoin::Transaction) -> Result<(), EsploraClientError> {
        self.client
            .broadcast(tx)
            .await
            .map_err(EsploraClientError::Esplora)?;

        Ok(())
    }
}
