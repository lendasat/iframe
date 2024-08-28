#![allow(clippy::unwrap_used)]

use axum::extract::ws::Message;
use axum::extract::ws::WebSocket;
use axum::extract::Path;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::response::IntoResponse;
use axum::Json;
use bitcoin::Address;
use futures::SinkExt;
use futures::StreamExt;
use futures::TryStreamExt;
use hub::mempool::Action;
use hub::mempool::AddressTransactions;
use hub::mempool::Block;
use hub::mempool::BlockTransactions;
use hub::mempool::Data;
use hub::mempool::TrackAddress;
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

    pub fn add_tx(&mut self, address: String, amount: u64) {
        let txid: [u8; 32] = thread_rng().gen();
        let txid = hex::encode(txid);

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

        let _ = self
            .events_tx
            .send(WsResponse::AddressTransactions(AddressTransactions {
                address_transactions: vec![tx.clone()],
            }));

        tracing::debug!(?tx, "Transaction found in mempool");

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
                };

                tracing::debug!(?tx, "Transaction confirmed");

                let _ = self
                    .events_tx
                    .send(WsResponse::BlockTransactions(BlockTransactions {
                        block_transactions: vec![tx.clone()],
                    }));
            }
        }

        let new_height = self.height + n;

        for height in (self.height + 1)..=new_height {
            let _ = self.events_tx.send(WsResponse::Block {
                block: Block { height },
                // We don't like this pattern, so we don't use it.
                block_transactions: None,
            });
        }

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
pub async fn get_address_transactions(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    let blockchain = blockchain.read().unwrap();

    let txs = blockchain.get_by_address(&address);

    Json(txs).into_response()
}

/// Internal API to add a transaction to the blockchain.
///
/// This does not attempt to mock a `mempool.space` API.
#[instrument(skip(blockchain))]
pub async fn post_tx(
    State(blockchain): State<Arc<RwLock<Blockchain>>>,
    Json(body): Json<PostTransaction>,
) -> impl IntoResponse {
    let mut blockchain = blockchain.write().unwrap();

    blockchain.add_tx(body.address, body.amount);

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
pub struct PostTransaction {
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
    let user_tracked_addresses = Arc::new(RwLock::new(Vec::<String>::new()));
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
        let user_tracked_addresses = user_tracked_addresses.clone();
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
                    WsResponse::AddressTransactions(AddressTransactions {
                        address_transactions: txs,
                    }) => {
                        let tracked_addresses = user_tracked_addresses.read().unwrap();

                        let txs = txs
                            .into_iter()
                            .filter(|tx| {
                                tx.vout.iter().any(|vout| {
                                    tracked_addresses.contains(
                                        &vout.scriptpubkey_address.assume_checked_ref().to_string(),
                                    )
                                })
                            })
                            .collect();

                        WsResponse::AddressTransactions(AddressTransactions {
                            address_transactions: txs,
                        })
                    }
                    WsResponse::BlockTransactions(BlockTransactions {
                        block_transactions: txs,
                    }) => {
                        let tracked_addresses = user_tracked_addresses.read().unwrap();

                        let txs = txs
                            .into_iter()
                            .filter(|tx| {
                                tx.vout.iter().any(|vout| {
                                    tracked_addresses.contains(
                                        &vout.scriptpubkey_address.assume_checked_ref().to_string(),
                                    )
                                })
                            })
                            .collect();

                        WsResponse::BlockTransactions(BlockTransactions {
                            block_transactions: txs,
                        })
                    }
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
                                .map(|height| Block { height })
                                .collect();

                            let _ = outgoing_queue_tx.send(WsResponse::Blocks { blocks }).await;
                        }
                    }
                    WsRequest::TrackAddress(TrackAddress { address }) => {
                        blockchain
                            .write()
                            .unwrap()
                            .tracked_addresses
                            .push(address.clone());
                        user_tracked_addresses.write().unwrap().push(address);
                    }
                    _ => {}
                }
            }
        }
    }
}
