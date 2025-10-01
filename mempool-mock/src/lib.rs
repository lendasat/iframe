#![allow(clippy::unwrap_used)]

use axum::extract::Path;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use bitcoin::Address;
use bitcoin::BlockHash;
use bitcoin::ScriptBuf;
use bitcoin::Txid;
use hex::FromHex;
use rand::thread_rng;
use rand::Rng;
use serde::Deserialize;
use serde::Serialize;
use std::str::FromStr;
use std::sync::Arc;
use std::sync::RwLock;
use std::time::SystemTime;
use tracing::instrument;

pub mod logger;

pub struct Blockchain {
    pub height: u32,
    pub txs: Vec<Tx>,

    /// Addresses tracked for _all_ users.
    pub tracked_addresses: Vec<String>,
}

impl Blockchain {
    pub fn get_by_address(&self, address: &str) -> Vec<Tx> {
        let script_pubkey = Address::from_str(address)
            .unwrap()
            .assume_checked()
            .script_pubkey();
        self.txs
            .iter()
            .filter(|tx| {
                tx.vin.iter().any(|i| {
                    i.prevout
                        .clone()
                        .map(|p| p.scriptpubkey == script_pubkey)
                        .unwrap_or_default()
                }) || tx
                    .vout
                    .iter()
                    .any(|vout| vout.scriptpubkey == script_pubkey)
            })
            .cloned()
            .collect::<Vec<_>>()
    }

    pub fn send_to_address(&mut self, address: String, amount: u64) {
        let txid: [u8; 32] = thread_rng().gen();
        let txid = hex::encode(txid);
        let txid = Txid::from_str(&txid).unwrap();

        let address = Address::from_str(&address).unwrap();
        let scriptpubkey = address.assume_checked().script_pubkey();

        let tx = Tx {
            txid,
            version: 2,
            locktime: 0,
            vin: vec![],
            vout: vec![Vout {
                value: amount,
                scriptpubkey,
            }],
            size: 0,
            weight: 0,
            status: TxStatus {
                confirmed: false,
                block_height: None,
                block_hash: None,
                block_time: None,
            },
            fee: 0,
        };

        tracing::debug!(?tx, "Transaction found in mempool");

        self.txs.push(tx);
    }

    pub fn add_tx(&mut self, tx: String) -> Txid {
        let tx: bitcoin::Transaction = bitcoin::consensus::encode::deserialize_hex(&tx).unwrap();

        let txid = tx.compute_txid();

        let all_prevouts = tx
            .input
            .iter()
            .map(|i| (i.previous_output.txid, i.previous_output.vout))
            .collect::<Vec<_>>();

        let mut maybe_prevout = None;
        for (txid, vout) in all_prevouts {
            maybe_prevout = self.txs.iter().find(|tx| tx.txid == txid).map(|tx| {
                let vout = tx.vout.get(vout as usize).unwrap();
                PrevOut {
                    value: vout.value,
                    scriptpubkey: vout.scriptpubkey.clone(),
                }
            });
        }
        let tx = Tx {
            txid,
            version: 2,
            locktime: 0,
            vin: tx
                .input
                .iter()
                .map(|i| Vin {
                    txid,
                    vout: 0,
                    prevout: maybe_prevout.clone(),
                    scriptsig: i.script_sig.clone(),
                    witness: vec![],
                    sequence: 0,
                    is_coinbase: false,
                })
                .collect(),
            vout: tx
                .output
                .iter()
                .map(|o| Vout {
                    scriptpubkey: o.script_pubkey.clone(),
                    value: o.value.to_sat(),
                })
                .collect(),
            size: 0,
            weight: 0,
            status: TxStatus {
                confirmed: false,
                block_height: None,
                block_hash: None,
                block_time: None,
            },
            fee: 0,
        };

        tracing::debug!(?tx, "Transaction found in mempool");

        self.txs.push(tx);

        txid
    }

    pub fn mine_blocks(&mut self, n: u32) {
        if n == 0 {
            return;
        }

        for tx in self.txs.iter_mut() {
            // Every unconfirmed transaction is included in the _next_ block.
            if !tx.status.confirmed {
                tx.status = TxStatus {
                    confirmed: true,
                    block_height: Some(self.height + 1),
                    block_hash: None,
                    block_time: Some(
                        SystemTime::now()
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                    ),
                };

                tracing::debug!(?tx, "Transaction confirmed");
            }
        }

        let new_height = self.height + n;

        self.height = new_height;

        tracing::debug!(height = self.height, "New blockheight");
    }
}

/// Mock of https://mempool.space/docs/api/rest#get-block-tip-height.
#[instrument(skip(blockchain), ret)]
pub async fn get_block_tip_height(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
) -> impl IntoResponse {
    let blockchain = blockchain.read().unwrap();

    (axum::http::StatusCode::OK, blockchain.height.to_string())
}

/// Mock of https://mempool.space/docs/api/rest#get-address-transactions.
///
/// The `after_txid` query parameter is not supported.
#[instrument(skip(blockchain), ret)]
pub async fn get_address_txes(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    let blockchain = blockchain.read().unwrap();

    let txs = blockchain.get_by_address(&address);

    Json(txs).into_response()
}

/// Mock of https://mempool.space/docs/api/rest#post-transaction.
#[instrument(skip(blockchain), ret)]
pub async fn post_tx(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    tx: String,
) -> impl IntoResponse {
    let mut blockchain = blockchain.write().unwrap();

    let txid = blockchain.add_tx(tx);

    (axum::http::StatusCode::OK, txid.to_string())
}

/// Internal API to add a transaction to the blockchain.
///
/// This does not attempt to mock a `mempool.space` API.
#[instrument(skip(blockchain))]
pub async fn send_to_address(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    Json(body): Json<SendToAddress>,
) -> impl IntoResponse {
    let mut blockchain = blockchain.write().unwrap();

    blockchain.send_to_address(body.address, body.amount);

    axum::http::StatusCode::OK
}

/// Internal API to "mine" blocks.
///
/// This does not attempt to mock a `mempool.space` API.
#[instrument(skip(blockchain))]
pub async fn mine_blocks(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    Path(n): Path<u32>,
) -> impl IntoResponse {
    let mut blockchain = blockchain.write().unwrap();

    blockchain.mine_blocks(n);

    axum::http::StatusCode::OK
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SendToAddress {
    pub address: String,
    pub amount: u64,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Tx {
    pub txid: Txid,
    pub version: i32,
    pub locktime: u32,
    pub vin: Vec<Vin>,
    pub vout: Vec<Vout>,
    /// Transaction size in raw bytes (NOT virtual bytes).
    pub size: usize,
    /// Transaction weight units.
    pub weight: u64,
    pub status: TxStatus,
    pub fee: u64,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Vout {
    pub value: u64,
    pub scriptpubkey: ScriptBuf,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PrevOut {
    pub value: u64,
    pub scriptpubkey: ScriptBuf,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Vin {
    pub txid: Txid,
    pub vout: u32,
    // None if coinbase
    pub prevout: Option<PrevOut>,
    pub scriptsig: ScriptBuf,
    #[serde(
        deserialize_with = "deserialize_witness",
        serialize_with = "serialize_witness",
        default
    )]
    pub witness: Vec<Vec<u8>>,
    pub sequence: u32,
    pub is_coinbase: bool,
}

fn deserialize_witness<'de, D>(d: D) -> Result<Vec<Vec<u8>>, D::Error>
where
    D: serde::de::Deserializer<'de>,
{
    let list = Vec::<String>::deserialize(d)?;
    list.into_iter()
        .map(|hex_str| Vec::<u8>::from_hex(&hex_str))
        .collect::<Result<Vec<Vec<u8>>, _>>()
        .map_err(serde::de::Error::custom)
}

fn serialize_witness<S>(witness: &[Vec<u8>], s: S) -> Result<S::Ok, S::Error>
where
    S: serde::ser::Serializer,
{
    let hex_strings: Vec<String> = witness.iter().map(hex::encode).collect();

    hex_strings.serialize(s)
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct TxStatus {
    pub confirmed: bool,
    pub block_height: Option<u32>,
    pub block_hash: Option<BlockHash>,
    pub block_time: Option<u64>,
}
