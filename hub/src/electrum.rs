use anyhow::anyhow;
use anyhow::Result;
use bitcoin::Address;
use bitcoin::Network;
use bitcoin::Txid;
use electrum_client::Client;
use electrum_client::ElectrumApi;
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::interval;
use xtra::Context;
use xtra::Mailbox;

/// Actor for monitoring Bitcoin addresses using an Electrum client.
pub struct Actor {
    /// Electrum client for communicating with the server.
    client: Client,
    /// Map of contract IDs to their corresponding contract addresses.
    tracked_contracts: HashMap<String, Address>,
    /// Map of contract IDs to a set of collateral TXIDs.
    txids_by_contract: HashMap<String, HashMap<Txid, bool>>,
    /// How often we look for transactions.
    check_interval: Duration,
}

impl Actor {
    /// Create a new Electrum actor.
    pub fn new(
        electrum_url: String,
        tracked_contracts: HashMap<String, Address>,
        network: Network,
    ) -> Result<Self> {
        let client = Client::new(&electrum_url)?;

        let check_interval_secs = match network {
            Network::Bitcoin => 30,
            _ => 5,
        };

        Ok(Self {
            client,
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
pub struct RegisterAddress {
    pub contract_id: String,
    pub address: Address,
}

/// Message to stop monitoring a contract.
///
/// TODO: This is currently unused.
#[derive(Debug)]
pub struct UnregisterContract {
    pub contract_id: String,
}

/// Message to get collateral transactions for a contract.
#[derive(Debug)]
pub struct GetCollateralTransactions {
    pub contract_id: String,
}

impl xtra::Handler<RegisterAddress> for Actor {
    type Return = Result<()>;

    async fn handle(&mut self, msg: RegisterAddress, _: &mut Context<Self>) -> Self::Return {
        tracing::debug!(
            contract_id = %msg.contract_id,
            address = %msg.address,
            "Registering address for monitoring"
        );

        self.tracked_contracts
            .insert(msg.contract_id.clone(), msg.address);
        self.txids_by_contract
            .insert(msg.contract_id, HashMap::new());
        Ok(())
    }
}

impl xtra::Handler<UnregisterContract> for Actor {
    type Return = Result<()>;

    async fn handle(&mut self, msg: UnregisterContract, _: &mut Context<Self>) -> Self::Return {
        tracing::debug!(
            contract_id = %msg.contract_id,
            "Unregistering contract from monitoring"
        );

        self.tracked_contracts.remove(&msg.contract_id);
        self.txids_by_contract.remove(&msg.contract_id);

        Ok(())
    }
}

impl xtra::Handler<GetCollateralTransactions> for Actor {
    type Return = HashMap<Txid, bool>;

    async fn handle(
        &mut self,
        msg: GetCollateralTransactions,
        _: &mut Context<Self>,
    ) -> Self::Return {
        tracing::trace!(
            contract_id = %msg.contract_id,
            "Getting collateral transactions for contract"
        );

        let txids = self
            .txids_by_contract
            .get(&msg.contract_id)
            .cloned()
            .unwrap_or_default();

        tracing::trace!(
            contract_id = %msg.contract_id,
            txid_count = txids.len(),
            "Returning collateral transactions for contract"
        );

        txids
    }
}

/// Internal message to trigger looking for collateral transactions.
#[derive(Debug)]
struct Check;

impl xtra::Handler<Check> for Actor {
    type Return = ();

    async fn handle(&mut self, _msg: Check, _: &mut Context<Self>) -> Self::Return {
        if self.tracked_contracts.is_empty() {
            return;
        }

        tracing::trace!(
            contract_count = self.tracked_contracts.len(),
            "Looking for collateral transactions for tracked contracts"
        );

        // Collect all scripts for batch request
        let scripts: Vec<_> = self
            .tracked_contracts
            .values()
            .map(|address| (address.script_pubkey()))
            .collect();

        if scripts.is_empty() {
            return;
        }

        // Convert to slice of references as required by the API
        let script_refs: Vec<&bitcoin::Script> = scripts.iter().map(|s| s.as_script()).collect();

        // Make batch request to Electrum
        match self.client.batch_script_get_history(script_refs) {
            Ok(histories) => {
                // Process each contract's history
                let contracts: Vec<_> = self.tracked_contracts.iter().collect();

                for ((contract_id, _), history) in contracts.into_iter().zip(histories.into_iter())
                {
                    let contract_txids = extract_txids(&history);

                    self.txids_by_contract
                        .insert(contract_id.to_string(), contract_txids);
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to batch check for {} contracts: {e:#}",
                    self.tracked_contracts.len()
                );
            }
        }
    }
}

fn extract_txids(history: &[electrum_client::GetHistoryRes]) -> HashMap<Txid, bool> {
    let mut set = HashMap::new();

    for tx in history {
        // Unconfirmed transactions have height 0 or negative values
        let is_confirmed = tx.height > 0;

        set.insert(tx.tx_hash, is_confirmed);
    }

    set
}
