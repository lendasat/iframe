#![allow(clippy::unwrap_used)]

use axum::body::Bytes;
use axum::extract::ws::Message;
use axum::extract::ws::WebSocket;
use axum::extract::Path;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::response::IntoResponse;
use axum::Json;
use bitcoin::absolute::LockTime;
use bitcoin::consensus::serialize;
use bitcoin::hashes::Hash;
use bitcoin::transaction::Version;
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::BlockHash;
use bitcoin::CompactTarget;
use bitcoin::TxMerkleNode;
use bitcoin::TxOut;
use bitcoin::Txid;
use futures::SinkExt;
use futures::StreamExt;
use futures::TryStreamExt;
use hub::mempool::Action;
use hub::mempool::Block;
use hub::mempool::Data;
use hub::mempool::Transaction;
use hub::mempool::TransactionStatus;
use hub::mempool::Vout;
use hub::mempool::WsRequest;
use hub::mempool::WsResponse;
use rand::thread_rng;
use rand::Rng;
use serde::Deserialize;
use serde::Serialize;
use std::str::FromStr;
use std::sync::Arc;
use std::sync::RwLock;
use tokio::sync::mpsc;
use tokio_stream::StreamExt as _;
use tracing::instrument;

pub mod logger;

pub struct Blockchain {
    pub height: u64,
    pub txs: Vec<Transaction>,

    /// Addresses tracked for _all_ users.
    pub tracked_addresses: Vec<String>,
    pub events_tx: tokio::sync::broadcast::Sender<WsResponse>,
}

impl Blockchain {
    pub fn get_by_address(&self, address: &str) -> Vec<Transaction> {
        self.txs
            .iter()
            .filter(|tx| {
                tx.vout.iter().any(|vout| {
                    vout.scriptpubkey_address.assume_checked_ref().to_string() == address
                })
            })
            .cloned()
            .collect::<Vec<_>>()
    }

    pub fn get_by_txid(&self, txid: &str) -> Option<Transaction> {
        let txid = Txid::from_str(txid).unwrap();

        self.txs.iter().find(|tx| tx.txid == txid).cloned()
    }

    pub fn send_to_address(&mut self, address: String, amount: u64) {
        let txid: [u8; 32] = thread_rng().gen();
        let txid = hex::encode(txid);
        let txid = Txid::from_str(&txid).unwrap();

        let tx = Transaction {
            txid,
            vout: vec![Vout {
                scriptpubkey_address: Address::from_str(&address).unwrap(),
                value: amount,
            }],
            status: TransactionStatus {
                confirmed: false,
                block_height: None,
            },
        };

        tracing::debug!(?tx, "Transaction found in mempool");

        self.txs.push(tx);
    }

    pub fn add_tx(&mut self, tx: String) -> Txid {
        let tx: bitcoin::Transaction = bitcoin::consensus::encode::deserialize_hex(&tx).unwrap();

        let txid = tx.compute_txid();

        let tx = Transaction {
            txid,
            vout: tx
                .output
                .iter()
                .map(|o| Vout {
                    scriptpubkey_address: Address::from_script(
                        &o.script_pubkey,
                        bitcoin::params::REGTEST.clone(),
                    )
                    .unwrap()
                    .as_unchecked()
                    .clone(),
                    value: o.value.to_sat(),
                })
                .collect(),
            status: TransactionStatus {
                confirmed: false,
                block_height: None,
            },
        };

        tracing::debug!(?tx, "Transaction found in mempool");

        self.txs.push(tx);

        txid
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
                };

                tracing::debug!(?tx, "Transaction confirmed");
            }
        }

        let new_height = self.height + n;

        for height in (self.height + 1)..=new_height {
            // FIXME: This is obviously wrong, but it's hardly worth doing this properly since we're
            // not really using this crate. We can fix it if we start using it again.
            let id = height.to_string();
            let _ = self.events_tx.send(WsResponse::Block {
                block: Block { height, id },
            });
        }

        self.height = new_height;

        tracing::debug!(height = self.height, "New blockheight");
    }

    pub fn get_block_raw(&self, height: u64) -> Option<bitcoin::block::Block> {
        let transactions: Vec<Transaction> = self
            .txs
            .iter()
            .filter(|tx| tx.status.block_height == Some(height))
            .cloned()
            .collect();
        tracing::debug!("Found {} blocks at height: {}", transactions.len(), height);

        let raw_block = bitcoin::block::Block {
            header: bitcoin::block::Header {
                version: bitcoin::block::Version::ONE,
                prev_blockhash: BlockHash::all_zeros(),
                merkle_root: TxMerkleNode::all_zeros(),
                time: 0,
                bits: CompactTarget::from_hex("0x000000").expect("valid hex"),
                nonce: 0,
            },
            txdata: transactions
                .iter()
                .map(|tx| bitcoin::Transaction {
                    version: Version::ONE,
                    lock_time: LockTime::from_height(77777).unwrap(),
                    input: vec![],
                    output: tx
                        .vout
                        .iter()
                        .map(|out| TxOut {
                            value: Amount::from_sat(out.value),
                            script_pubkey: out
                                .scriptpubkey_address
                                .clone()
                                .assume_checked()
                                .script_pubkey(),
                        })
                        .collect(),
                })
                .collect(),
        };

        Some(raw_block)
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
pub async fn get_address_transactions(
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

/// Mock of https://mempool.space/docs/api/rest#get-transaction.
#[instrument(skip(blockchain), ret)]
pub async fn get_tx(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    Path(txid): Path<String>,
) -> Result<impl IntoResponse, (axum::http::StatusCode, String)> {
    let blockchain = blockchain.read().unwrap();

    let tx = match blockchain.get_by_txid(&txid) {
        Some(tx) => tx,
        None => {
            return Err((
                axum::http::StatusCode::NOT_FOUND,
                "Transaction not found".to_string(),
            ))
        }
    };

    Ok(Json(tx).into_response())
}

/// Mock of https://mempool.space/docs/api/rest#get-block-raw.
#[instrument(skip(blockchain), ret)]
pub async fn get_block_raw(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    Path(height): Path<u64>,
) -> Result<impl IntoResponse, (axum::http::StatusCode, String)> {
    let blockchain = blockchain.read().unwrap();

    let raw_block = match blockchain.get_block_raw(height) {
        Some(block) => block,
        None => {
            return Err((
                axum::http::StatusCode::NOT_FOUND,
                "Block not found".to_string(),
            ))
        }
    };

    let serialized_block = serialize(&raw_block);

    Ok(Bytes::from(serialized_block))
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
    Path(n): Path<u64>,
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

pub async fn handle_ws_upgrade(
    ws: WebSocketUpgrade,
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_ws(socket, blockchain))
}

pub async fn handle_ws(socket: WebSocket, blockchain: Arc<RwLock<Blockchain>>) {
    let wants_blocks = Arc::new(RwLock::new(false));

    // Websocket to subscribers.
    let (mut ws_sink, mut ws_stream) = socket.split();

    // Receiver of blockchain events.
    let event_rx = {
        let blockchain = blockchain.read().unwrap();
        blockchain.events_tx.subscribe()
    };

    // Outgoing message queue (to be sent via the WS sink).
    let (outgoing_queue_tx, outgoing_queue_rx) = mpsc::channel::<WsResponse>(10);

    let mut merged_stream = {
        let event_stream =
            tokio_stream::wrappers::BroadcastStream::new(event_rx).map_err(anyhow::Error::new);
        let outgoing_queue_stream = tokio_stream::StreamExt::map(
            tokio_stream::wrappers::ReceiverStream::new(outgoing_queue_rx),
            anyhow::Ok,
        );

        event_stream.merge(outgoing_queue_stream)
    };

    tokio::spawn({
        let wants_blocks = wants_blocks.clone();
        async move {
            while let Some(Ok(msg)) = tokio_stream::StreamExt::next(&mut merged_stream).await {
                let msg = match msg {
                    WsResponse::Blocks { .. } | WsResponse::Block { .. } => {
                        if *wants_blocks.read().unwrap() {
                            msg
                        } else {
                            continue;
                        }
                    }
                    WsResponse::LoadingIndicator { response } => {
                        WsResponse::LoadingIndicator { response }
                    }
                    WsResponse::LoadingIndicators {} => WsResponse::LoadingIndicators {},
                    WsResponse::Conversions {} => WsResponse::Conversions {},
                };

                let msg = Message::Text(serde_json::to_string(&msg).unwrap());

                ws_sink.send(msg).await.unwrap();
            }
        }
    });

    while let Some(Ok(msg)) = StreamExt::next(&mut ws_stream).await {
        if let Message::Text(text) = msg {
            if let Ok(msg) = serde_json::from_str::<WsRequest>(&text) {
                match msg {
                    WsRequest::Action {
                        action: Action::Want,
                        data,
                    } if data.contains(&Data::Blocks) => {
                        *wants_blocks.write().unwrap() = true;

                        let height = blockchain.read().unwrap().height;

                        if height == 0 {
                            let _ = outgoing_queue_tx
                                .send(WsResponse::Blocks { blocks: Vec::new() })
                                .await;
                        } else {
                            // Mempool gives you some metadata about the last 6 blocks. The client
                            // can used the highest block to figure out
                            // the current blockchain height.
                            let blocks = (height.checked_sub(5).unwrap_or_default()..=height)
                                .map(|height| Block {
                                    height,
                                    id: height.to_string(),
                                })
                                .collect();

                            let _ = outgoing_queue_tx.send(WsResponse::Blocks { blocks }).await;
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}
