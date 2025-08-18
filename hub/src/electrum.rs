use crate::db;
use crate::Notifications;
use anyhow::anyhow;
use anyhow::Result;
use bitcoin::Address;
use bitcoin::Network;
use bitcoin::Txid;
use electrum_client::Client;
use electrum_client::ElectrumApi;
use sqlx::Pool;
use sqlx::Postgres;
use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use xtra::Context;
use xtra::Mailbox;

/// Actor for monitoring Bitcoin addresses using an Electrum client.
pub struct Actor {
    /// Electrum client for communicating with the server.
    client: Client,
    db: Pool<Postgres>,
    notifications: Arc<Notifications>,
    /// Map of contract IDs to their corresponding contract addresses.
    tracked_contracts: HashMap<String, TrackedContract>,
    /// Map of contract IDs to a set of collateral TXIDs.
    txids_by_contract: HashMap<String, HashSet<Txid>>,
    /// How often we look for transactions.
    check_interval: Duration,
}

pub struct TrackedContract {
    address: Address,
    is_waiting_for_collateral_seen: bool,
}

impl TrackedContract {
    pub fn new(address: Address, is_waiting_for_collateral_seen: bool) -> Self {
        Self {
            address,
            is_waiting_for_collateral_seen,
        }
    }
}

impl Actor {
    /// Create a new Electrum actor.
    pub fn new(
        electrum_url: String,
        db: Pool<Postgres>,
        notifications: Arc<Notifications>,
        tracked_contracts: HashMap<String, TrackedContract>,
        network: Network,
    ) -> Result<Self> {
        let client = Client::new(&electrum_url)?;

        let check_interval_secs = match network {
            Network::Bitcoin => 30,
            _ => 5,
        };

        Ok(Self {
            client,
            db,
            notifications,
            tracked_contracts,
            txids_by_contract: HashMap::new(),
            check_interval: Duration::from_secs(check_interval_secs),
        })
    }
}

impl xtra::Actor for Actor {
    type Stop = anyhow::Error;

    async fn started(&mut self, mailbox: &Mailbox<Self>) -> Result<()> {
        tracing::info!("Electrum actor started");

        // Start periodic checking
        let address = mailbox.address();
        tokio::spawn({
            let check_interval = self.check_interval;
            async move {
                let mut check_interval = interval(check_interval);
                loop {
                    check_interval.tick().await;

                    if let Err(e) = address.send(Check).await {
                        tracing::error!("Failed to send Check message: {e:#}");
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    async fn stopped(self) -> Self::Stop {
        anyhow!("Electrum actor stopped")
    }
}

/// Message to register a new address for monitoring.
#[derive(Debug)]
pub(crate) struct RegisterAddress {
    contract_id: String,
    address: Address,
}

impl RegisterAddress {
    pub(crate) fn new(contract_id: String, address: Address) -> Self {
        Self {
            contract_id,
            address,
        }
    }
}

impl xtra::Handler<RegisterAddress> for Actor {
    type Return = Result<()>;

    async fn handle(&mut self, msg: RegisterAddress, _: &mut Context<Self>) -> Self::Return {
        tracing::debug!(
            contract_id = %msg.contract_id,
            address = %msg.address,
            "Registering address for monitoring"
        );

        self.tracked_contracts.insert(
            msg.contract_id.clone(),
            TrackedContract {
                address: msg.address,
                is_waiting_for_collateral_seen: true,
            },
        );
        self.txids_by_contract
            .insert(msg.contract_id, HashSet::new());
        Ok(())
    }
}

/// Internal message to trigger looking for collateral transactions.
#[derive(Debug)]
struct Check;

impl xtra::Handler<Check> for Actor {
    type Return = ();

    async fn handle(&mut self, _msg: Check, context: &mut Context<Self>) -> Self::Return {
        if self.tracked_contracts.is_empty() {
            return;
        }

        tracing::trace!(
            contract_count = self.tracked_contracts.len(),
            "Looking for collateral transactions for tracked contracts"
        );

        // Collect all scripts for batch request.
        let scripts: Vec<_> = self
            .tracked_contracts
            .values()
            .map(|TrackedContract { address, .. }| (address.script_pubkey()))
            .collect();

        if scripts.is_empty() {
            return;
        }

        let script_refs: Vec<&bitcoin::Script> = scripts.iter().map(|s| s.as_script()).collect();

        // Make batch request to Electrum.
        match self.client.batch_script_get_history(script_refs) {
            Ok(histories) => {
                // Process each contract's history.
                for ((contract_id, _), history) in
                    self.tracked_contracts.iter().zip(histories.into_iter())
                {
                    let latest_unconfirmed_txids = extract_txids(&history);
                    let new_unconfirmed_txids: HashSet<_> =
                        match self.txids_by_contract.get(contract_id) {
                            Some(previous_unconfirmed_txids) => latest_unconfirmed_txids
                                .difference(previous_unconfirmed_txids)
                                .copied()
                                .collect(),
                            None => latest_unconfirmed_txids,
                        };

                    // Persist new unconfirmed collateral-funding transactions. We may end up
                    // attempting to repeat some insertions after a restart, but that's okay.
                    for new_txid in new_unconfirmed_txids.iter() {
                        if let Err(e) =
                            db::transactions::insert_funding_txid(&self.db, contract_id, new_txid)
                                .await
                        {
                            tracing::error!(
                                contract_id,
                                txid = %new_txid,
                                "Failed to persist funding TXID: {e:#}"
                            );
                        }
                    }

                    // Update internal state with latest transactions.
                    self.txids_by_contract
                        .insert(contract_id.to_string(), new_unconfirmed_txids);
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to batch check for {} contracts: {e:#}",
                    self.tracked_contracts.len()
                );
            }
        }

        // After updating the internal state, queue up a message to see if we need to report a
        // status change for any contracts.
        tokio::spawn(context.mailbox().address().send(ReportCollateralSeen));
    }
}

/// Internal message to see if we need to report a status change for any tracked contracts.
#[derive(Debug)]
struct ReportCollateralSeen;

impl xtra::Handler<ReportCollateralSeen> for Actor {
    type Return = ();

    async fn handle(&mut self, _msg: ReportCollateralSeen, _: &mut Context<Self>) -> Self::Return {
        for (contract_id, contract) in self
            .tracked_contracts
            .iter_mut()
            .filter(|(_, c)| c.is_waiting_for_collateral_seen)
        {
            match self.txids_by_contract.get(contract_id) {
                // We don't distinguish between confirmed or unconfirmed, to keep it simple.
                Some(txs) if !txs.is_empty() => {
                    match db::contracts::report_collateral_seen(&self.db, contract_id).await {
                        Ok(status_changed) => {
                            contract.is_waiting_for_collateral_seen = false;

                            if status_changed {
                                self.notifications.send_collateral_seen(contract_id).await;
                            }
                        }
                        Err(e) => {
                            tracing::error!(
                                contract_id,
                                "Failed to report CollateralSeen to DB: {e:#}"
                            );
                        }
                    }
                }
                _ => {}
            }
        }
    }
}

fn extract_txids(history: &[electrum_client::GetHistoryRes]) -> HashSet<Txid> {
    let mut set = HashSet::new();

    for tx in history {
        // Unconfirmed transactions have height 0 or negative values.
        if tx.height <= 0 {
            set.insert(tx.tx_hash);
        }
    }

    set
}
