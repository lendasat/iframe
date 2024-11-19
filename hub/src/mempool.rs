use crate::config::Config;
use crate::db;
use crate::email::Email;
use crate::model::ContractStatus;
use anyhow::anyhow;
use anyhow::ensure;
use anyhow::Context;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::Address;
use bitcoin::Network;
use bitcoin::OutPoint;
use bitcoin::Txid;
use futures::stream::SplitSink;
use futures::SinkExt;
use futures::StreamExt;
use reqwest::StatusCode;
use serde::Deserialize;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use std::collections::HashMap;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio_tungstenite::connect_async_tls_with_config;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::Connector;
use tokio_tungstenite::MaybeTlsStream;
use tokio_tungstenite::WebSocketStream;
use tracing::instrument;
use xtra::Mailbox;

const MIN_CONFIRMATIONS: u64 = 1;
const WS_RECONNECT_TIMEOUT_SECS: u64 = 2;

pub struct Actor {
    tracked_contracts: HashMap<Address, TrackedContract>,
    // It would be nicer to just monitor output spends, but this does not seem to be supported by
    // mempool. As such, we have to monitor each claim transaction separately.
    tracked_claim_txs: HashMap<Txid, TrackedClaimTx>,
    block_height: u64,
    db: Pool<Postgres>,
    rest_client: MempoolRestClient,
    ws_url: String,
    ws_sink: Option<SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>>,
    is_test_network: bool,
    config: Config,
}

#[derive(Debug, Clone)]
struct TrackedContract {
    contract_id: String,
    /// A contract may be funded by more than one output.
    collateral_outputs: HashMap<OutPoint, CollateralOutput>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct CollateralOutput {
    outpoint: OutPoint,
    amount_sats: u64,
    state: ConfirmationState,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum ConfirmationState {
    Seen,
    OnChain { height: u64 },
    Confirmed,
}

#[derive(Debug, Clone)]
struct TrackedClaimTx {
    contract_id: String,
    txid: Txid,
}

impl Actor {
    pub fn new(db: Pool<Postgres>, network: Network, config: Config) -> Self {
        let rest_url = config.mempool_rest_url.clone();
        let ws_url = config.mempool_ws_url.clone();

        let is_test_network = !matches!(network, Network::Bitcoin);
        let rest_client = MempoolRestClient::new(rest_url, is_test_network);

        Self {
            tracked_contracts: HashMap::default(),
            tracked_claim_txs: HashMap::default(),
            block_height: 0,
            db,
            rest_client,
            ws_url,
            ws_sink: None,
            is_test_network,
            config,
        }
    }

    async fn update_claim_txs_status(&mut self) {
        for TrackedClaimTx {
            contract_id,
            txid: claim_txid,
        } in self.tracked_claim_txs.clone().values()
        {
            if let Err(e) = self.update_claim_tx_status(contract_id, claim_txid).await {
                tracing::error!(
                    contract_id,
                    %claim_txid,
                    "Failed to mark contract as closed: {e:#}"
                );

                continue;
            }
        }
    }

    async fn update_claim_tx_status(&mut self, contract_id: &str, claim_txid: &Txid) -> Result<()> {
        let tx = self
            .rest_client
            .get_tx(claim_txid)
            .await
            .context("Failed to get claim TX")?;

        if let Some(Transaction {
            status: TransactionStatus {
                confirmed: true, ..
            },
            ..
        }) = tx
        {
            tracing::info!(
                contract_id,
                %claim_txid,
                "Claim TX confirmed"
            );

            db::transactions::insert_claim_txid(&self.db, contract_id, claim_txid).await?;
            db::contracts::mark_contract_as_closed(&self.db, contract_id)
                .await
                .context("Failed to mark contract as closed")?;

            self.tracked_claim_txs.remove(claim_txid);
        }

        Ok(())
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
        let contracts = db::contracts::load_open_contracts(&self.db).await?;

        let starting_block_height = self.rest_client.get_block_tip_height().await?;

        self.block_height = starting_block_height;

        let connector = if self.is_test_network {
            let connector = native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(true)
                .build()?;

            Some(Connector::NativeTls(connector))
        } else {
            None
        };

        let ws_url = self.ws_url.clone();
        let (ws_stream, _) =
            connect_async_tls_with_config(ws_url.clone(), None, false, connector.clone())
                .await
                .context("Failed to establish WS connection")?;

        let (mut sink, stream) = ws_stream.split();

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
                        .send(TrackContractFunding {
                            contract_id: contract.id.clone(),
                            contract_address: contract_address.clone().assume_checked(),
                        })
                        .await
                    {
                        tracing::error!(?contract, "Failed to track contract: {e:#}");
                    };
                }

                let mut stream = stream;

                loop {
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
                                                let _ = actor
                                                    .send(ContractUpdate { transactions })
                                                    .await;
                                            }
                                        }
                                        WsResponse::AddressTransactions(AddressTransactions {
                                            address_transactions: transactions,
                                        })
                                        | WsResponse::BlockTransactions(BlockTransactions {
                                            block_transactions: transactions,
                                        }) => {
                                            let _ =
                                                actor.send(ContractUpdate { transactions }).await;
                                        }
                                        WsResponse::LoadingIndicator { .. }
                                        | WsResponse::LoadingIndicators {}
                                        | WsResponse::Conversions {} => {
                                            // ignored
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

                    let ws_stream = loop {
                        tracing::debug!(url = ws_url, "Reconnecting to mempool WS");

                        match connect_async_tls_with_config(
                            ws_url.clone(),
                            None,
                            false,
                            connector.clone(),
                        )
                        .await
                        {
                            Ok((ws_stream, _)) => break ws_stream,
                            Err(e) => {
                                tracing::error!(
                                    "Failed to reconnect to mempool WS: {e:?}. \
                                     Retrying in {WS_RECONNECT_TIMEOUT_SECS} seconds"
                                );

                                tokio::time::sleep(Duration::from_secs(WS_RECONNECT_TIMEOUT_SECS))
                                    .await;
                            }
                        };
                    };

                    let (sink, new_stream) = ws_stream.split();
                    let _ = actor.send(NewWsSink(sink)).await;

                    stream = new_stream;
                }
            }
        });

        Ok(())
    }

    async fn stopped(self) -> Self::Stop {
        anyhow!("Mempool actor stopped")
    }
}

/// Internal message to tell the [`Actor`] to update the state of a tracked contract.
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

                let outpoint = OutPoint {
                    txid: tx.txid,
                    vout: index as u32,
                };

                let state = match tx.status.block_height {
                    Some(tx_block_height) => {
                        let confirmations =
                            calculate_confirmations(self.block_height, tx_block_height);
                        if confirmations >= MIN_CONFIRMATIONS {
                            ConfirmationState::Confirmed
                        } else {
                            ConfirmationState::OnChain {
                                height: tx_block_height,
                            }
                        }
                    }
                    None => ConfirmationState::Seen,
                };

                let collateral_output = CollateralOutput {
                    outpoint,
                    amount_sats: vout.value,
                    state,
                };

                // We either insert or overwrite the collateral output. Since this is based on the
                // latest contract update, overwriting should be desirable.
                contract
                    .collateral_outputs
                    .insert(outpoint, collateral_output);

                let confirmed_collateral_sats = confirmed_collateral_sats(
                    &contract
                        .collateral_outputs
                        .values()
                        .cloned()
                        .collect::<Vec<_>>(),
                );

                if let Err(err) = db::transactions::insert_funding_txid(
                    &self.db,
                    &contract.contract_id,
                    &outpoint.txid,
                )
                .await
                {
                    tracing::error!("Failed at inserting funding tx id: {err:?}");
                }

                match db::contracts::update_collateral(
                    &self.db,
                    &contract.contract_id,
                    confirmed_collateral_sats,
                )
                .await
                {
                    Ok(contract) => {
                        if contract.status == ContractStatus::CollateralConfirmed {
                            // We don't want to fail this upwards because the contract status has
                            // been udpated already.
                            if let Err(err) = async {
                                let lender = db::lenders::get_user_by_id(
                                    &self.db,
                                    contract.lender_id.as_str(),
                                )
                                .await?
                                .context("Lender not found")?;
                                let email = Email::new(self.config.clone());
                                let loan_url = format!(
                                    "{}/my-contracts/{}",
                                    self.config.lender_frontend_origin.clone(),
                                    contract.id
                                );

                                email
                                    .send_loan_collateralized(lender, loan_url.as_str())
                                    .await?;
                                Ok::<(), anyhow::Error>(())
                            }
                            .await
                            {
                                tracing::error!(
                                    "Failed at notifying lender about funded contract {err:?}"
                                );
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(?contract, "Failed to update collateral: {e:#}");
                    }
                }
            }
        }
    }
}

/// Message to tell the [`Actor`] to start tracking a collateral contract until it is funded.
#[derive(Debug)]
pub struct TrackContractFunding {
    pub contract_id: String,
    pub contract_address: Address,
}

impl xtra::Handler<TrackContractFunding> for Actor {
    type Return = Result<()>;

    async fn handle(
        &mut self,
        msg: TrackContractFunding,
        _: &mut xtra::Context<Self>,
    ) -> Self::Return {
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

        let collateral_outputs_vec =
            collateral_outputs(&txs, &msg.contract_address, self.block_height);
        let confirmed_collateral_sats = confirmed_collateral_sats(&collateral_outputs_vec);

        let collateral_outputs = HashMap::from_iter(
            collateral_outputs_vec
                .clone()
                .into_iter()
                .map(|o| (o.outpoint, o)),
        );

        let contract_id = &msg.contract_id;

        self.tracked_contracts.insert(
            msg.contract_address.clone(),
            TrackedContract {
                contract_id: contract_id.clone(),
                collateral_outputs,
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

        for outpoint in collateral_outputs_vec {
            if let Err(err) = db::transactions::insert_funding_txid(
                &self.db,
                contract_id,
                &outpoint.outpoint.txid,
            )
            .await
            {
                tracing::error!("Failed inserting funding txid {err:?}");
            }
        }

        // Ideally we would only update when we learn something new, but alas.
        let contract =
            db::contracts::update_collateral(&self.db, contract_id, confirmed_collateral_sats)
                .await?;

        if contract.status == ContractStatus::CollateralConfirmed {
            // We don't want to fail this upwards because the contract status has been udpated
            // already.
            if let Err(err) = {
                let lender = db::lenders::get_user_by_id(&self.db, contract.lender_id.as_str())
                    .await?
                    .context("Lender not found")?;
                let email = Email::new(self.config.clone());
                let loan_url = format!(
                    "{}/my-contracts/{}",
                    self.config.lender_frontend_origin.clone(),
                    contract.id
                );

                email
                    .send_loan_collateralized(lender, loan_url.as_str())
                    .await?;
                Ok::<(), anyhow::Error>(())
            } {
                tracing::error!("Failed at notifying lender about funded contract {err:?}");
            }
        }
        Ok(())
    }
}

/// Message to tell the [`Actor`] to track the status of a collateral-claim transaction.
#[derive(Debug)]
pub struct TrackCollateralClaim {
    pub contract_id: String,
    pub claim_txid: Txid,
}

impl xtra::Handler<TrackCollateralClaim> for Actor {
    type Return = Result<()>;

    async fn handle(
        &mut self,
        msg: TrackCollateralClaim,
        _: &mut xtra::Context<Self>,
    ) -> Self::Return {
        tracing::debug!(?msg, "Instructed to track claim TX");

        if self.tracked_claim_txs.contains_key(&msg.claim_txid) {
            tracing::warn!(?msg, "Already tracking a claim TX with the same TXID");
            return Ok(());
        }

        self.tracked_claim_txs.insert(
            msg.claim_txid,
            TrackedClaimTx {
                contract_id: msg.contract_id.clone(),
                txid: msg.claim_txid,
            },
        );

        self.update_claim_tx_status(&msg.contract_id, &msg.claim_txid)
            .await?;

        Ok(())
    }
}

/// Internal message to update the [`Actor`]'s block height.
#[derive(Debug)]
struct NewBlockHeight(u64);

impl xtra::Handler<NewBlockHeight> for Actor {
    type Return = ();

    async fn handle(&mut self, msg: NewBlockHeight, _: &mut xtra::Context<Self>) -> Self::Return {
        self.block_height = msg.0;

        for (_, contract) in self.tracked_contracts.iter_mut() {
            let confirmed_collateral_sats_before = confirmed_collateral_sats(
                &contract
                    .collateral_outputs
                    .values()
                    .cloned()
                    .collect::<Vec<_>>(),
            );

            for (_, output) in contract.collateral_outputs.iter_mut() {
                let new_state = match output.state {
                    ConfirmationState::OnChain {
                        height: tx_block_height,
                    } => {
                        let contract_id = &contract.contract_id;

                        let confirmations =
                            calculate_confirmations(self.block_height, tx_block_height);
                        if confirmations >= MIN_CONFIRMATIONS {
                            tracing::info!(
                                contract_id,
                                amount_sats = output.amount_sats,
                                "Collateral output reached necessary number of confirmations"
                            );

                            ConfirmationState::Confirmed
                        } else {
                            output.state
                        }
                    }
                    ConfirmationState::Seen | ConfirmationState::Confirmed => output.state,
                };

                output.state = new_state;
            }

            let confirmed_collateral_sats_after = confirmed_collateral_sats(
                &contract
                    .collateral_outputs
                    .values()
                    .cloned()
                    .collect::<Vec<_>>(),
            );
            for outpoint in contract.collateral_outputs.keys() {
                if let Err(err) = db::transactions::insert_funding_txid(
                    &self.db,
                    &contract.contract_id,
                    &outpoint.txid,
                )
                .await
                {
                    tracing::error!("Failed at inserting funding tx id: {err:?}");
                }
            }

            // NOTE: We cannot actually learn if a collateral output was unconfirmed via the
            // WebSocket subscription. But we can learn this information after a restart, via the
            // REST API.
            if confirmed_collateral_sats_after != confirmed_collateral_sats_before {
                match db::contracts::update_collateral(
                    &self.db,
                    &contract.contract_id,
                    confirmed_collateral_sats_after,
                )
                .await
                {
                    Ok(contract) => {
                        if contract.status == ContractStatus::CollateralConfirmed {
                            // We don't want to fail this upwards because the contract status has
                            // been udpated already.
                            if let Err(err) = async {
                                let lender = db::lenders::get_user_by_id(
                                    &self.db,
                                    contract.lender_id.as_str(),
                                )
                                .await?
                                .context("Lender not found")?;
                                let email = Email::new(self.config.clone());
                                let loan_url = format!(
                                    "{}/my-contracts/{}",
                                    self.config.lender_frontend_origin.clone(),
                                    contract.id
                                );

                                email
                                    .send_loan_collateralized(lender, loan_url.as_str())
                                    .await?;
                                Ok::<(), anyhow::Error>(())
                            }
                            .await
                            {
                                tracing::error!(
                                    "Failed at notifying lender about funded contract {err:?}"
                                );
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(?contract, "Failed to update collateral: {e:#}");
                    }
                }
            }
        }

        self.update_claim_txs_status().await;
    }
}

/// Message to tell the [`Actor`] to post a transaction.
#[derive(Debug)]
pub struct PostTx(pub String);

impl xtra::Handler<PostTx> for Actor {
    type Return = Result<()>;

    async fn handle(&mut self, msg: PostTx, _: &mut xtra::Context<Self>) -> Self::Return {
        self.rest_client.post_tx(msg.0).await?;

        Ok(())
    }
}

/// Message to get the outputs with the given collateral address.
#[derive(Debug)]
pub struct GetCollateralOutputs(pub Address<NetworkUnchecked>);

impl xtra::Handler<GetCollateralOutputs> for Actor {
    type Return = Vec<(OutPoint, u64)>;

    async fn handle(
        &mut self,
        msg: GetCollateralOutputs,
        _: &mut xtra::Context<Self>,
    ) -> Self::Return {
        let address = msg.0.assume_checked();
        match self.tracked_contracts.get(&address) {
            Some(contract) => contract
                .collateral_outputs
                .iter()
                .map(|(outpoint, output)| (*outpoint, output.amount_sats))
                .collect(),
            None => Vec::new(),
        }
    }
}

/// Internal message to update the [`Actor`]'s mempool WS sink.
#[derive(Debug)]
struct NewWsSink(SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>);

impl xtra::Handler<NewWsSink> for Actor {
    type Return = ();

    async fn handle(&mut self, msg: NewWsSink, _: &mut xtra::Context<Self>) -> Self::Return {
        self.ws_sink = Some(msg.0)
    }
}

/// Process the `txs` to find all the outputs which pay to the given collateral `address`.
#[instrument(skip(txs), ret)]
fn collateral_outputs(
    txs: &[Transaction],
    address: &Address,
    blockchain_height: u64,
) -> Vec<CollateralOutput> {
    let outputs = txs.iter().flat_map(|tx| {
        tx.vout
            .iter()
            .enumerate()
            .filter_map(|(i, vout)| {
                (vout.scriptpubkey_address.clone().assume_checked() == *address)
                    .then_some((i, (tx.txid, vout.value, tx.status.block_height)))
            })
            .collect::<Vec<_>>()
    });

    outputs
        .map(|(index, (txid, amount_sats, block_height))| {
            let outpoint = OutPoint {
                txid,
                vout: index as u32,
            };

            let state = match block_height {
                Some(tx_block_height) => {
                    let confirmations = calculate_confirmations(blockchain_height, tx_block_height);
                    if confirmations >= MIN_CONFIRMATIONS {
                        ConfirmationState::Confirmed
                    } else {
                        ConfirmationState::OnChain {
                            height: tx_block_height,
                        }
                    }
                }
                None => ConfirmationState::Seen,
            };

            CollateralOutput {
                outpoint,
                amount_sats,
                state,
            }
        })
        .collect::<Vec<_>>()
}

fn confirmed_collateral_sats(collateral_outputs: &[CollateralOutput]) -> u64 {
    collateral_outputs
        .iter()
        .filter(|o| matches!(o.state, ConfirmationState::Confirmed))
        .fold(0, |acc, o| acc + o.amount_sats)
}

struct MempoolRestClient {
    client: reqwest::Client,
    url: String,
}

impl MempoolRestClient {
    fn new(url: String, is_test_network: bool) -> Self {
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(is_test_network)
            .build()
            .expect("valid build");

        Self { client, url }
    }

    async fn get_address_transactions(&self, address: &Address) -> Result<Vec<Transaction>> {
        let res = self
            .client
            .get(format!("{}/api/address/{address}/txs", self.url))
            .send()
            .await?;

        let res = res.error_for_status()?;

        let txs = res.json().await?;

        Ok(txs)
    }

    async fn get_tx(&self, txid: &Txid) -> Result<Option<Transaction>> {
        let res = self
            .client
            .get(format!("{}/api/tx/{txid}", self.url))
            .send()
            .await?;

        if let StatusCode::NOT_FOUND = res.status() {
            return Ok(None);
        }

        let res = res.error_for_status()?;

        let tx = res.json().await?;

        Ok(Some(tx))
    }

    async fn post_tx(&self, tx: String) -> Result<()> {
        let res = self
            .client
            .post(format!("{}/api/tx", self.url))
            .body(tx)
            .send()
            .await?;

        res.error_for_status()?;

        Ok(())
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
    LoadingIndicator {
        response: Option<String>,
    },
    LoadingIndicators {},
    Conversions {},
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

#[cfg(test)]
mod tests {
    use super::*;
    use insta::assert_debug_snapshot;
    use std::str::FromStr;

    #[test]
    fn test_collateral_outputs() {
        let collateral_address =
            Address::from_str("tb1ph4kwft3ese6guh8cdkpfezr53tnz506s5lz7x62n5m4j5ksxlk5sckj2dr")
                .unwrap();
        let other_address =
            Address::from_str("tb1qtslhzseyts27gp5ahtud9ftt3l8ceytxk22y03sfnylex56msmsse5t80u")
                .unwrap();

        let tx0 = Transaction {
            txid: Txid::from_str(
                "44fe3d70a3058eb1bef62e24379b4865ada8332f9ee30752cf606f37343461a0",
            )
            .unwrap(),
            vout: vec![
                Vout {
                    scriptpubkey_address: other_address.clone(),
                    value: 10,
                },
                Vout {
                    scriptpubkey_address: collateral_address.clone(),
                    value: 100,
                },
            ],
            status: TransactionStatus {
                confirmed: false,
                block_height: None,
            },
        };

        let tx1 = Transaction {
            txid: Txid::from_str(
                "44fe3d70a3058eb1bef62e24379b4865ada8332f9ee30752cf606f37343461a1",
            )
            .unwrap(),
            vout: vec![
                Vout {
                    scriptpubkey_address: collateral_address.clone(),
                    value: 100,
                },
                Vout {
                    scriptpubkey_address: other_address.clone(),
                    value: 10,
                },
            ],
            status: TransactionStatus {
                confirmed: false,
                block_height: None,
            },
        };

        let tx2 = Transaction {
            txid: Txid::from_str(
                "44fe3d70a3058eb1bef62e24379b4865ada8332f9ee30752cf606f37343461a2",
            )
            .unwrap(),
            vout: vec![
                Vout {
                    scriptpubkey_address: other_address.clone(),
                    value: 10,
                },
                Vout {
                    scriptpubkey_address: collateral_address.clone(),
                    value: 100,
                },
            ],
            status: TransactionStatus {
                confirmed: false,
                block_height: None,
            },
        };

        let txs = vec![tx0, tx1, tx2];

        let blockchain_height = 1;
        let outputs = collateral_outputs(
            &txs,
            &collateral_address.assume_checked(),
            blockchain_height,
        );

        assert_debug_snapshot!(outputs);
    }
}
