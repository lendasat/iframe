use axum::extract::Path;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use rand::thread_rng;
use rand::Rng;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct Blockchain {
    pub height: u64,
    pub txs: Vec<AddressTransaction>,
}

impl Blockchain {
    pub fn get_by_address(&self, address: &str) -> Vec<AddressTransaction> {
        self.txs
            .iter()
            .filter(|tx| {
                tx.vout
                    .iter()
                    .any(|vout| vout.scriptpubkey_address == address)
            })
            .cloned()
            .collect::<Vec<_>>()
    }

    pub fn add_tx(&mut self, address: String, amount: u64) {
        let txid: [u8; 32] = thread_rng().gen();
        let txid = hex::encode(txid);

        let tx = AddressTransaction {
            txid,
            vout: vec![Vout {
                scriptpubkey_address: address,
                value: amount,
            }],
            status: TransactionStatus {
                confirmed: false,
                block_height: None,
            },
        };

        self.txs.push(tx);
    }

    pub fn mine_blocks(&mut self, n: u64) {
        if n == 0 {
            return;
        }

        for tx in self.txs.iter_mut() {
            // Every unconfirmed transaction is included in the _next_ block.
            if !tx.status.confirmed {
                tx.status = TransactionStatus {
                    confirmed: true,
                    block_height: Some(self.height + 1),
                }
            }
        }

        self.height += n
    }
}

/// Mock of https://mempool.space/docs/api/rest#get-address-transactions.
///
/// The `after_txid` query parameter is not supported.
pub async fn get_address_transactions(
    State(blockchain): State<Arc<Mutex<Blockchain>>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    let blockchain = blockchain.lock().await;

    let txs = blockchain.get_by_address(&address);

    if txs.is_empty() {
        return axum::http::StatusCode::NOT_FOUND.into_response();
    }

    Json(txs).into_response()
}

/// Internal API to add a transaction to the blockchain.
///
/// This does not attempt to mock a `mempool.space` API.
pub async fn post_tx(
    State(blockchain): State<Arc<Mutex<Blockchain>>>,
    Json(body): Json<PostTransaction>,
) -> impl IntoResponse {
    let mut blockchain = blockchain.lock().await;

    blockchain.add_tx(body.address, body.amount);

    axum::http::StatusCode::OK
}

/// Internal API to "mine" blocks.
///
/// This does not attempt to mock a `mempool.space` API.
pub async fn mine_blocks(
    State(blockchain): State<Arc<Mutex<Blockchain>>>,
    Path(n): Path<u64>,
) -> impl IntoResponse {
    let mut blockchain = blockchain.lock().await;

    blockchain.mine_blocks(n);

    axum::http::StatusCode::OK
}

#[derive(Debug, Serialize, Clone)]
pub struct AddressTransaction {
    pub txid: String,
    pub vout: Vec<Vout>,
    pub status: TransactionStatus,
}

#[derive(Debug, Serialize, Clone)]
pub struct TransactionStatus {
    pub confirmed: bool,
    pub block_height: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct Vout {
    pub scriptpubkey_address: String,
    pub value: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostTransaction {
    pub address: String,
    pub amount: u64,
}
