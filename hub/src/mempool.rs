use crate::config::Config;
use crate::db;
use crate::email::Email;
use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use backon::ExponentialBuilder;
use backon::Retryable;
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
use tokio_tungstenite::tungstenite;
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
            // TODO: We could look for claim TXs directly in the block.

            // We use 5 attempts since the caller is a background task.
            let attempts = 5;
            if let Err(e) = self
                .update_claim_tx_status(contract_id, claim_txid, attempts)
                .await
            {
                tracing::error!(
                    contract_id,
                    %claim_txid,
                    "Failed to mark contract as closed: {e:#}"
                );

                continue;
            }
        }
    }

    async fn update_claim_tx_status(
        &mut self,
        contract_id: &str,
        claim_txid: &Txid,
        attempts: usize,
    ) -> Result<()> {
        let get_tx = || async { self.rest_client.get_tx(claim_txid).await };
        let tx = get_tx
            .retry(ExponentialBuilder::default().with_max_times(attempts))
            .sleep(tokio::time::sleep)
            .notify(|err: &anyhow::Error, dur: Duration| {
                tracing::warn!(
                    "Retrying getting claim TX {} after {:?}. Error: {:?}",
                    claim_txid,
                    dur,
                    err,
                );
            })
            .await
            // After running out of retries we give up.
            .with_context(|| format!("Failed to get claim TX {claim_txid}"))?;

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

fn calculate_confirmations(known_tip: u64, tx_block_height: u64) -> u64 {
    if tx_block_height > known_tip {
        tracing::warn!(
            tx_block_height,
            known_tip,
            "TX block height ahead of known blockchain tip. Defaulting to 1 confirmation"
        );
    }

    known_tip.checked_sub(tx_block_height).unwrap_or_default() + 1
}

impl xtra::Actor for Actor {
    type Stop = anyhow::Error;

    async fn started(&mut self, mailbox: &Mailbox<Self>) -> Result<()> {
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
            let db = self.db.clone();
            async move {
                let mut stream = stream;
                loop {
                    // TODO: Maybe we should not go against the database every time. We could rely
                    // on the `Actor` state.
                    let contracts = db::contracts::load_open_contracts(&db)
                        .await
                        .expect("contracts to start mempool actor");
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

                        // TODO: I'm slightly concerned about hitting rate limits after a `hub`
                        // restart.
                        if let Err(e) = actor
                            .send(TrackContractFunding {
                                contract_id: contract.id.clone(),
                                contract_address: contract_address.clone().assume_checked(),
                                attempts: 5,
                            })
                            .await
                            .expect("actor to be alive")
                        {
                            tracing::error!(?contract, "Failed to track contract: {e:#}");
                        }

                        // Try to avoid hitting rate limits by spacing out our requests to Mempool.
                        tokio::time::sleep(Duration::from_millis(500)).await;
                    }

                    tracing::debug!(url = ws_url, "Listening on mempool WS");
                    while let Some(message) = stream.next().await {
                        match message {
                            Ok(Message::Text(text)) => {
                                match serde_json::from_str::<WsResponse>(&text) {
                                    Ok(response) => match response {
                                        // What you get when you first subscribe to block updates.
                                        WsResponse::Blocks { blocks } => {
                                            if let Some(block) = blocks
                                                .into_iter()
                                                .max_by(|x, y| x.height.cmp(&y.height))
                                            {
                                                actor
                                                    .send(NewBlockHeight {
                                                        height: block.height,
                                                        hash: block.id,
                                                    })
                                                    .await
                                                    .expect("actor to be alive");
                                            }
                                        }
                                        // Subsequent blocks.
                                        WsResponse::Block { block } => {
                                            actor
                                                .send(NewBlockHeight {
                                                    height: block.height,
                                                    hash: block.id,
                                                })
                                                .await
                                                .expect("actor to be alive");
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
                            Err(tungstenite::Error::Protocol(
                                tungstenite::error::ProtocolError::ResetWithoutClosingHandshake,
                            )) => {
                                // Unfortunately, we expect frequent (once every 5 minutes),
                                // unceremonious disconnects from the Mempool WS API. Thus, we only
                                // log this on DEBUG.
                                tracing::debug!("Mempool WS disconnected");
                                break;
                            }
                            Err(e) => {
                                tracing::error!("Mempool WS disconnected: {e:?}");
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
                            Ok((mut ws_stream, _)) => {
                                // Resubscribe to block updates.
                                let msg = serde_json::to_string(&WsRequest::Action {
                                    action: Action::Want,
                                    data: vec![Data::Blocks],
                                })
                                .expect("valid message");

                                if let Err(e) = ws_stream.send(Message::Text(msg)).await {
                                    tracing::error!(
                                        "Failed to subscribe to block updates \
                                         after reconnect: {e:?}"
                                    );
                                }

                                break ws_stream;
                            }
                            Err(e) => {
                                tracing::error!("Failed to reconnect to Mempool WS: {e:?}");
                            }
                        };

                        tracing::debug!(
                            "Reconnecting to Mempool WS in {WS_RECONNECT_TIMEOUT_SECS} seconds"
                        );
                        tokio::time::sleep(Duration::from_secs(WS_RECONNECT_TIMEOUT_SECS)).await;
                    };

                    let (sink, new_stream) = ws_stream.split();

                    actor
                        .send(NewWsSink(sink))
                        .await
                        .expect("actor to be alive");

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

/// Message to tell the [`Actor`] to start tracking a collateral contract until it is funded.
#[derive(Debug)]
pub struct TrackContractFunding {
    contract_id: String,
    contract_address: Address,
    attempts: usize,
}

impl TrackContractFunding {
    pub fn new(contract_id: String, contract_address: Address) -> Self {
        Self {
            contract_id,
            contract_address,
            attempts: 1,
        }
    }
}

impl xtra::Handler<TrackContractFunding> for Actor {
    type Return = Result<()>;

    async fn handle(
        &mut self,
        msg: TrackContractFunding,
        _: &mut xtra::Context<Self>,
    ) -> Self::Return {
        if self.tracked_contracts.contains_key(&msg.contract_address) {
            // We are already tracking this address, all updates now come as we get new blocks. We
            // don't want to call Mempool's REST API if we can help it.

            return Ok(());
        }

        tracing::debug!(?msg, "Instructed to track contract");

        let get_address_txs = || async {
            self.rest_client
                .get_address_transactions(&msg.contract_address)
                .await
        };
        let txs = get_address_txs
            .retry(ExponentialBuilder::default().with_max_times(msg.attempts))
            .sleep(tokio::time::sleep)
            .notify(|err: &anyhow::Error, dur: Duration| {
                tracing::warn!(
                    "Retrying getting address TXs for address {} after {:?}. Error: {:?}",
                    msg.contract_address,
                    dur,
                    err,
                );
            })
            .await
            // After running out of retries we give up.
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

        // As a side-effect, here we are checking if the contract address was reused: if this is a
        // newly approved contract (still in the `Requested` state) and the address already has
        // money in it, this contract address most likely belongs to a different contract already!
        // Thus we cannot proceed safely.
        let (contract, is_newly_confirmed) =
            db::contracts::update_collateral(&self.db, contract_id, confirmed_collateral_sats)
                .await?;

        if is_newly_confirmed {
            send_loan_collateralized_email_to_lender(
                &self.db,
                self.config.clone(),
                contract_id,
                &contract.lender_id,
            )
            .await
            .context("Failed to send loan collateralized email to lender")?;
        }

        // TODO: Wrap DB calls in transaction.
        for output in collateral_outputs_vec {
            let txid = output.outpoint.txid;

            tracing::debug!(%contract_id, %txid, "Learnt about funding TX");

            if let Err(err) =
                db::transactions::insert_funding_txid(&self.db, contract_id, &txid).await
            {
                tracing::error!("Failed inserting funding txid {err:?}");
            }
        }

        // Only track this contract if the previous steps succeed.
        self.tracked_contracts.insert(
            msg.contract_address.clone(),
            TrackedContract {
                contract_id: contract_id.clone(),
                collateral_outputs,
            },
        );

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

        // Only two attempts so that the caller doesn't hang.
        let attempts = 2;
        self.update_claim_tx_status(&msg.contract_id, &msg.claim_txid, attempts)
            .await?;

        Ok(())
    }
}

/// Internal message to update the [`Actor`]'s block height.
#[derive(Debug)]
struct NewBlockHeight {
    height: u64,
    hash: String,
}

impl xtra::Handler<NewBlockHeight> for Actor {
    type Return = ();

    async fn handle(&mut self, msg: NewBlockHeight, _: &mut xtra::Context<Self>) -> Self::Return {
        let known_tip = msg.height;

        self.block_height = known_tip;

        let get_block_txs = || async { self.rest_client.get_block_transactions(&msg.hash).await };
        let block_txs = get_block_txs
            // We are happy to retry a few times since blocks come every 10 minutes or so on
            // mainnet.
            .retry(ExponentialBuilder::default().with_max_times(5))
            .sleep(tokio::time::sleep)
            .notify(|err: &anyhow::Error, dur: Duration| {
                tracing::warn!(
                    "Retrying getting block TXs for block {} after {:?}. Error: {:?}",
                    msg.hash,
                    dur,
                    err,
                );
            })
            .await
            .inspect_err(|e| {
                tracing::error!("Failed to get block transactions: {e:#}");
            })
            // After running out of retries we proceed without any TXs.
            .unwrap_or_default();

        // Every time we learn about a new block we iterate through all the tracked contracts.
        for (address, contract) in self.tracked_contracts.iter_mut() {
            // If the tracked contract address was in this block, we know that at least one
            // collateral output was newly confirmed.

            // I think Clippy is wrong.
            #[allow(clippy::unnecessary_filter_map)]
            let relevant_txos = block_txs
                .iter()
                .filter_map(|tx| {
                    Some(
                        tx.output
                            .iter()
                            .enumerate()
                            .filter(|(_, o)| o.script_pubkey == address.script_pubkey())
                            .map(|(i, o)| {
                                (
                                    OutPoint {
                                        txid: tx.compute_txid(),
                                        vout: i as u32,
                                    },
                                    o,
                                )
                            })
                            .collect::<Vec<_>>(),
                    )
                })
                .flatten()
                .collect::<Vec<_>>();

            // Give the first confirmation to each collateral TXO for this contract found in the
            // block.
            for (outpoint, txo) in relevant_txos.iter() {
                let state = {
                    // The transaction was just included in a block.
                    let confirmations = 1;

                    tracing::debug!(
                        contract_id = contract.contract_id,
                        ?outpoint,
                        ?txo,
                        height = known_tip,
                        "First confirmation of collateral TXO"
                    );

                    if confirmations >= MIN_CONFIRMATIONS {
                        ConfirmationState::Confirmed
                    } else {
                        ConfirmationState::OnChain { height: known_tip }
                    }
                };

                // If this TXO is truly new, we record the corresponding collateral funding TX.
                if !contract.collateral_outputs.contains_key(outpoint) {
                    let txid = outpoint.txid;
                    let contract_id = &contract.contract_id;

                    tracing::debug!(%contract_id, %txid, "Learnt about funding TX");

                    // Save in the database as a new funding TX.
                    if let Err(err) =
                        db::transactions::insert_funding_txid(&self.db, contract_id, &txid).await
                    {
                        tracing::error!("Failed to insert funding TXID: {err:?}");
                    }
                }

                contract
                    .collateral_outputs
                    .entry(*outpoint)
                    .and_modify(|o| o.state = state)
                    .or_insert(CollateralOutput {
                        outpoint: *outpoint,
                        amount_sats: txo.value.to_sat(),
                        state,
                    });
            }

            // If the tracked contract address was not found in this block, we just have to
            // consider if an output with that address simply gained a new confirmation.
            if relevant_txos.is_empty() {
                for (_, collateral_output) in contract.collateral_outputs.iter_mut() {
                    if let ConfirmationState::OnChain {
                        height: tx_block_height,
                    } = collateral_output.state
                    {
                        let confirmations = calculate_confirmations(known_tip, tx_block_height);

                        if confirmations >= MIN_CONFIRMATIONS {
                            collateral_output.state = ConfirmationState::Confirmed;
                        }
                    }
                }
            }

            let updated_confirmed_collateral_sats = confirmed_collateral_sats(
                &contract
                    .collateral_outputs
                    .values()
                    .cloned()
                    .collect::<Vec<_>>(),
            );

            let (contract, is_newly_confirmed) = match db::contracts::update_collateral(
                &self.db,
                &contract.contract_id,
                updated_confirmed_collateral_sats,
            )
            .await
            {
                Ok(res) => res,
                Err(e) => {
                    tracing::error!(?contract, "Failed to update collateral: {e:#}");
                    continue;
                }
            };

            if is_newly_confirmed {
                if let Err(err) = send_loan_collateralized_email_to_lender(
                    &self.db,
                    self.config.clone(),
                    &contract.id,
                    &contract.lender_id,
                )
                .await
                {
                    tracing::error!("Failed at notifying lender about funded contract {err:?}");
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
        let post_tx = || async { self.rest_client.post_tx(&msg.0).await };
        post_tx
            // Only 2 attemps to publish a transaction since the caller is waiting.
            .retry(ExponentialBuilder::default().with_max_times(2))
            .sleep(tokio::time::sleep)
            .notify(|err: &anyhow::Error, dur: Duration| {
                tracing::warn!("Retrying posting TX after {:?}. Error: {:?}", dur, err,);
            })
            .await
            // After running out of retries we give up.
            .context("Failed to post TX")?;

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

    async fn get_block_transactions(&self, hash: &str) -> Result<Vec<bitcoin::Transaction>> {
        let res = self
            .client
            .get(format!("{}/api/block/{hash}/raw", self.url))
            .send()
            .await?;

        let res = res.error_for_status()?;

        let block = res.bytes().await?;
        let block: bitcoin::block::Block = bitcoin::consensus::deserialize(&block)?;

        Ok(block.txdata)
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

    async fn post_tx(&self, tx: &str) -> Result<()> {
        let res = self
            .client
            .post(format!("{}/api/tx", self.url))
            .body(tx.to_string())
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
    pub id: String,
}

/// Messages sent to the mempool server.
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum WsRequest {
    Action { action: Action, data: Vec<Data> },
}

/// Messages coming from the mempool server.
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum WsResponse {
    Blocks { blocks: Vec<Block> },
    Block { block: Block },
    LoadingIndicator { response: Option<String> },
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

async fn send_loan_collateralized_email_to_lender(
    db: &Pool<Postgres>,
    config: Config,
    contract_id: &str,
    lender_id: &str,
) -> Result<()> {
    let contract_emails = db::contract_emails::load_contract_emails(db, contract_id)
        .await
        .context("Failed to check if collateral-funded email was sent")?;

    if !contract_emails.collateral_funded_sent {
        let lender = db::lenders::get_user_by_id(db, lender_id)
            .await?
            .context("Cannot send collateral-funded email to unknown lender")?;

        let loan_url = format!(
            "{}/my-contracts/{}",
            config.lender_frontend_origin, contract_id
        );
        let email = Email::new(config);

        email
            .send_loan_collateralized(lender, loan_url.as_str())
            .await
            .context("Failed to send collateral-funded email")?;

        db::contract_emails::mark_collateral_funded_as_sent(db, contract_id)
            .await
            .context("Failed to mark collateral-funded email as sent")?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use insta::assert_debug_snapshot;
    use std::str::FromStr;

    #[test]
    fn test_calculate_confirmations() {
        let known_tip = 10;
        let tx_block_height = 10;

        let n_conf = calculate_confirmations(known_tip, tx_block_height);

        assert_eq!(n_conf, 1);

        let known_tip = 12;
        let tx_block_height = 10;

        let n_conf = calculate_confirmations(known_tip, tx_block_height);

        assert_eq!(n_conf, 3);

        let known_tip = 9;
        let tx_block_height = 10;

        let n_conf = calculate_confirmations(known_tip, tx_block_height);

        assert_eq!(n_conf, 1);
    }

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
