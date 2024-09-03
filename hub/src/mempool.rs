// TODO: We will need to watch _spending_ transactions too! Luckily, I think it's the same API.
// Although I haven't mocked those responses yet.

use crate::db;
use anyhow::anyhow;
use anyhow::bail;
use anyhow::ensure;
use anyhow::Context;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::Address;
use bitcoin::OutPoint;
use bitcoin::Txid;
use futures::stream::SplitSink;
use futures::SinkExt;
use futures::StreamExt;
use serde::Deserialize;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use std::collections::HashMap;
use tokio::net::TcpStream;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::MaybeTlsStream;
use tokio_tungstenite::WebSocketStream;
use tracing::instrument;
use xtra::Mailbox;

const MIN_CONFIRMATIONS: u64 = 2;

pub struct Actor {
    tracked_contracts: HashMap<Address, TrackedContract>,
    block_height: u64,
    db: Pool<Postgres>,
    rest_client: MempoolRestClient,
    ws_url: String,
    ws_sink: Option<SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>>,
}

#[derive(Debug, Clone)]
struct TrackedContract {
    contract_id: String,
    contract_address: Address,
    initial_collateral_sats: u64,
    status: ContractStatus,
}

#[derive(Debug, Clone, PartialEq)]
enum ContractStatus {
    /// Contract not seen.
    Pending,
    /// Contract found in mempool.
    Seen(OutPoint),
    /// Contract confirmed.
    Confirmed {
        outpoint: OutPoint,
        block_height: u64,
    },
}

impl Actor {
    pub fn new(rest_url: String, ws_url: String, db: Pool<Postgres>) -> Self {
        let rest_client = MempoolRestClient::new(rest_url);

        Self {
            tracked_contracts: HashMap::default(),
            block_height: 0,
            db,
            rest_client,
            ws_url,
            ws_sink: None,
        }
    }
}

fn calculate_confirmations(current_block_height: u64, tx_block_height: u64) -> u64 {
    if tx_block_height > current_block_height {
        tracing::warn!("We appear to be behind in blocks");
        return 0;
    }

    current_block_height
        .checked_sub(tx_block_height)
        .unwrap_or_default()
        + 1
}

impl xtra::Actor for Actor {
    type Stop = anyhow::Error;

    async fn started(&mut self, mailbox: &Mailbox<Self>) -> Result<()> {
        let contracts = db::contracts::load_contracts_pending_confirmation(&self.db).await?;

        let starting_block_height = self.rest_client.get_block_tip_height().await?;

        self.block_height = starting_block_height;

        let (ws_stream, _) = connect_async(format!("{}/ws", self.ws_url))
            .await
            .context("Failed to establish WS connection")?;

        let (mut sink, mut stream) = ws_stream.split();

        // Subscribe to block updates.
        let msg = serde_json::to_string(&WsRequest::Action {
            action: Action::Want,
            data: vec![Data::Blocks],
        })?;
        sink.send(Message::Text(msg)).await?;

        self.ws_sink = Some(sink);

        tokio::spawn({
            let actor = mailbox.address();
            async move {
                for contract in contracts {
                    let contract_address = match contract.contract_address {
                        Some(ref contract_address) => contract_address,
                        None => {
                            tracing::error!(
                                ?contract,
                                "Cannot track pending contract without contract address"
                            );
                            continue;
                        }
                    };

                    if let Err(e) = actor
                        .send(TrackContract {
                            contract_id: contract.id.clone(),
                            contract_address: contract_address.clone().assume_checked(),
                            initial_collateral_sats: contract.initial_collateral_sats,
                        })
                        .await
                    {
                        tracing::error!(?contract, "Failed to track contract: {e:#}");
                    };
                }

                while let Some(message) = stream.next().await {
                    match message {
                        Ok(Message::Text(text)) => {
                            match serde_json::from_str::<WsResponse>(&text) {
                                Ok(response) => match response {
                                    // What you get when you first subscribe to block updates.
                                    WsResponse::Blocks { blocks } => {
                                        let height = blocks
                                            .iter()
                                            .max_by(|x, y| x.height.cmp(&y.height))
                                            .map(|block| block.height)
                                            .unwrap_or_default();

                                        let _ = actor.send(NewBlockHeight(height)).await;
                                    }
                                    // Subsequent blocks.
                                    WsResponse::Block {
                                        block,
                                        block_transactions,
                                    } => {
                                        let _ = actor.send(NewBlockHeight(block.height)).await;

                                        if let Some(transactions) = block_transactions {
                                            let _ =
                                                actor.send(ContractUpdate { transactions }).await;
                                        }
                                    }
                                    WsResponse::AddressTransactions(AddressTransactions {
                                        address_transactions: transactions,
                                    })
                                    | WsResponse::BlockTransactions(BlockTransactions {
                                        block_transactions: transactions,
                                    }) => {
                                        let _ = actor.send(ContractUpdate { transactions }).await;
                                    }
                                },
                                Err(e) => {
                                    tracing::warn!(
                                        response = text,
                                        "Failed to deserialize response: {e:?}",
                                    );
                                }
                            }
                        }
                        Ok(msg) => {
                            tracing::debug!(?msg, "Unhandled message");
                        }
                        Err(e) => {
                            tracing::error!("WS error: {e:?}");
                            break;
                        }
                    }
                }
            }
        });

        Ok(())
    }

    async fn stopped(self) -> Self::Stop {
        anyhow!("Mempool actor stopped")
    }
}

/// Internal message to tell the [`Actor`] actor to update the state of a tracked contract.
#[derive(Debug)]
struct ContractUpdate {
    /// Set of transactions which may provide an update on the state of one or several of our
    /// tracked contracts.
    transactions: Vec<Transaction>,
}

impl xtra::Handler<ContractUpdate> for Actor {
    type Return = ();

    async fn handle(&mut self, msg: ContractUpdate, _: &mut xtra::Context<Self>) -> Self::Return {
        tracing::debug!(update = ?msg, "Handling contract update");

        let mut contracts_to_remove = Vec::<Address>::new();
        for tx in msg.transactions {
            for (index, vout) in tx.vout.iter().enumerate() {
                let contract = match self
                    .tracked_contracts
                    .get_mut(vout.scriptpubkey_address.assume_checked_ref())
                {
                    Some(contract) => contract,
                    // Irrelevant output.
                    None => continue,
                };

                if vout.value < contract.initial_collateral_sats {
                    tracing::error!(?contract, ?tx, "Insufficient collateral amount in contract");
                    continue;
                }

                let outpoint = OutPoint {
                    txid: tx.txid,
                    vout: index as u32,
                };

                let status = if !tx.status.confirmed {
                    ContractStatus::Seen(outpoint)
                } else {
                    match tx.status.block_height {
                        Some(tx_block_height) => ContractStatus::Confirmed {
                            outpoint,
                            block_height: tx_block_height,
                        },
                        None => ContractStatus::Seen(outpoint),
                    }
                };

                // Update the contract status in the DB to `Seen` if the collateral was just spotted
                // in mempool.
                if let ContractStatus::Seen(outpoint) = status {
                    if contract.status == ContractStatus::Pending {
                        // TODO!!! Consider other spot(s).
                        if let Err(e) = db::contracts::mark_contract_as_seen(
                            &self.db,
                            &contract.contract_id,
                            outpoint,
                        )
                        .await
                        {
                            tracing::error!(?contract, "Failed to mark contract as seen: {e:#}");
                            continue;
                        }
                    }
                }

                contract.status = status;

                // Check if the contract is already sufficiently confirmed.
                if let ContractStatus::Confirmed {
                    outpoint,
                    block_height: tx_block_height,
                } = contract.status
                {
                    let confirmations = calculate_confirmations(self.block_height, tx_block_height);

                    if confirmations >= MIN_CONFIRMATIONS {
                        let contract_id = &contract.contract_id;

                        tracing::info!(
                            contract_id,
                            "Contract reached necessary number of confirmations"
                        );

                        if let Err(e) = db::contracts::mark_contract_as_confirmed(
                            &self.db,
                            contract_id,
                            outpoint,
                        )
                        .await
                        {
                            tracing::error!(
                                ?contract,
                                "Failed to mark contract as confirmed: {e:#}"
                            );
                            continue;
                        };

                        contracts_to_remove.push(contract.contract_address.clone());
                    }
                }
            }
        }

        for address in contracts_to_remove {
            self.tracked_contracts.remove(&address);
        }
    }
}

/// Message to tell the [`Actor`] actor to start tracking a collateral contract.
#[derive(Debug)]
pub struct TrackContract {
    pub contract_id: String,
    pub contract_address: Address,
    pub initial_collateral_sats: u64,
}

impl xtra::Handler<TrackContract> for Actor {
    type Return = Result<()>;

    async fn handle(&mut self, msg: TrackContract, _: &mut xtra::Context<Self>) -> Self::Return {
        tracing::debug!(?msg, "Instructed to track contract");

        ensure!(
            !self.tracked_contracts.contains_key(&msg.contract_address),
            "Already tracking a contract with the same address"
        );

        let txs = self
            .rest_client
            .get_address_transactions(&msg.contract_address)
            .await
            .context("Failed to get address transactions")?;

        let contract_status =
            derive_contract_status(&txs, &msg.contract_address, msg.initial_collateral_sats)
                .await
                .context("Failed to get confirmations")?;

        let contract_id = &msg.contract_id;

        // Check if the contract is already sufficiently confirmed.
        match contract_status {
            ContractStatus::Pending => {}
            ContractStatus::Seen(outpoint) => {
                tracing::info!(
                    contract_id,
                    confirmations = 0,
                    "Contract not yet sufficiently confirmed"
                );

                db::contracts::mark_contract_as_seen(&self.db, contract_id, outpoint)
                    .await
                    .context("Failed to mark contract as confirmed")?;
            }
            ContractStatus::Confirmed {
                outpoint,
                block_height: tx_block_height,
            } => {
                let confirmations = calculate_confirmations(self.block_height, tx_block_height);

                if confirmations >= MIN_CONFIRMATIONS {
                    tracing::info!(
                        contract_id,
                        "Contract reached necessary number of confirmations"
                    );

                    db::contracts::mark_contract_as_confirmed(&self.db, contract_id, outpoint)
                        .await
                        .context("Failed to mark contract as confirmed")?;

                    return Ok(());
                } else {
                    tracing::info!(
                        contract_id,
                        confirmations,
                        "Contract not yet sufficiently confirmed"
                    );

                    db::contracts::mark_contract_as_seen(&self.db, contract_id, outpoint)
                        .await
                        .context("Failed to mark contract as confirmed")?;
                }
            }
        };

        self.tracked_contracts.insert(
            msg.contract_address.clone(),
            TrackedContract {
                contract_id: msg.contract_id,
                contract_address: msg.contract_address.clone(),
                initial_collateral_sats: msg.initial_collateral_sats,
                status: contract_status,
            },
        );

        // Subscribe to updates on this address via mempool's WS.
        let msg = serde_json::to_string(&WsRequest::TrackAddress(TrackAddress {
            address: msg.contract_address.to_string(),
        }))?;
        self.ws_sink
            .as_mut()
            .expect("sink")
            .send(Message::Text(msg))
            .await
            .context("Failed to send TrackAddress message via WS")?;

        Ok(())
    }
}

/// Internal message to update the [`Actor`] actor block height.
#[derive(Debug)]
struct NewBlockHeight(u64);

impl xtra::Handler<NewBlockHeight> for Actor {
    type Return = ();

    async fn handle(&mut self, msg: NewBlockHeight, _: &mut xtra::Context<Self>) -> Self::Return {
        self.block_height = msg.0;

        let mut contracts_to_remove = Vec::<Address>::new();
        for contract in self.tracked_contracts.values() {
            // We only consider transactions with at least 1 confirmation for simplicity. We know
            // that unconfirmed transactions are handled via the `track-address` WS subscription.
            if let ContractStatus::Confirmed {
                outpoint,
                block_height: tx_block_height,
            } = contract.status
            {
                let confirmations = calculate_confirmations(self.block_height, tx_block_height);
                if confirmations >= MIN_CONFIRMATIONS {
                    let contract_id = &contract.contract_id;

                    tracing::info!(
                        contract_id,
                        "Contract reached necessary number of confirmations"
                    );

                    if let Err(e) =
                        db::contracts::mark_contract_as_confirmed(&self.db, contract_id, outpoint)
                            .await
                    {
                        tracing::error!(?contract, "Failed to mark contract as confirmed: {e:#}");
                        continue;
                    };

                    contracts_to_remove.push(contract.contract_address.clone());
                }
            }
        }

        for address in contracts_to_remove {
            self.tracked_contracts.remove(&address);
        }
    }
}

#[instrument(skip(txs), err(Debug), ret)]
async fn derive_contract_status(
    txs: &[Transaction],
    address: &Address,
    amount: u64,
) -> Result<ContractStatus> {
    if txs.is_empty() {
        return Ok(ContractStatus::Pending);
    }

    // TODO: Handle the possibility that the address is reused.
    let tx = txs
        .first()
        .context("No transactions to derive contract status from")?;

    let (index, vout) = tx
        .vout
        .iter()
        .enumerate()
        .find(|(_, vout)| vout.scriptpubkey_address.clone().assume_checked() == *address)
        .context("No collateral contract in address transactions")?;

    if vout.value < amount {
        bail!("Insufficient collateral amount for {address} in {tx:?}, expected {amount} sats");
    }

    let outpoint = OutPoint {
        txid: tx.txid,
        vout: index as u32,
    };

    if !tx.status.confirmed {
        return Ok(ContractStatus::Seen(outpoint));
    }

    let status = match tx.status.block_height {
        Some(tx_block_height) => ContractStatus::Confirmed {
            outpoint,
            block_height: tx_block_height,
        },
        None => ContractStatus::Seen(outpoint),
    };

    Ok(status)
}

struct MempoolRestClient {
    client: reqwest::Client,
    url: String,
}

impl MempoolRestClient {
    fn new(url: String) -> Self {
        let client = reqwest::Client::new();

        Self { client, url }
    }

    async fn get_address_transactions(&self, address: &Address) -> Result<Vec<Transaction>> {
        let res = self
            .client
            .get(format!("{}/api/address/{address}/txs", self.url))
            .send()
            .await?;

        let res = res.error_for_status()?;

        let txs: Vec<Transaction> = res.json().await?;

        Ok(txs)
    }

    async fn get_block_tip_height(&self) -> Result<u64> {
        let res = self
            .client
            .get(format!("{}/api/blocks/tip/height", self.url))
            .send()
            .await?;

        let res = res.error_for_status()?;

        let height = res.text().await?;
        let height = height.parse()?;

        Ok(height)
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AddressTransactions {
    #[serde(rename = "address-transactions")]
    pub address_transactions: Vec<Transaction>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub txid: Txid,
    pub vout: Vec<Vout>,
    pub status: TransactionStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Vout {
    pub scriptpubkey_address: Address<NetworkUnchecked>,
    pub value: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransactionStatus {
    pub confirmed: bool,
    pub block_height: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BlockTransactions {
    #[serde(rename = "block-transactions")]
    pub block_transactions: Vec<Transaction>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Block {
    pub height: u64,
}

/// Messages sent to the mempool server.
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum WsRequest {
    Action { action: Action, data: Vec<Data> },
    TrackAddress(TrackAddress),
}

/// Messages coming from the mempool server.
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum WsResponse {
    Blocks {
        blocks: Vec<Block>,
    },
    Block {
        block: Block,
        #[serde(rename = "block-transactions")]
        block_transactions: Option<Vec<Transaction>>,
    },
    AddressTransactions(AddressTransactions),
    BlockTransactions(BlockTransactions),
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Want,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Data {
    Blocks,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TrackAddress {
    #[serde(rename = "track-address")]
    pub address: String,
}
