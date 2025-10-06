use crate::blockchain;
use crate::config::Config;
use crate::db;
use crate::mark_as_principal_given::mark_as_principal_given;
use crate::model::LoanPayout;
use crate::moon;
use crate::Notifications;
use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::Address;
use bitcoin::OutPoint;
use bitcoin::ScriptBuf;
use esplora_client::Tx;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use time::OffsetDateTime;
use xtra::Mailbox;

pub struct Actor {
    block_height: u32,
    db: Pool<Postgres>,
    config: Config,
    clients: Vec<blockchain::esplora_client::EsploraClient>,
    current_client_index: usize,
    notifications: Arc<Notifications>,
    moon: Arc<moon::Manager>,
}

impl Actor {
    pub fn new(
        db: Pool<Postgres>,
        config: Config,
        notifications: Arc<Notifications>,
        moon: Arc<moon::Manager>,
    ) -> Result<Self> {
        let mut clients = vec![];
        for esplora_url in &config.esplora_urls {
            let url = esplora_url.to_string();
            clients.push(
                blockchain::esplora_client::EsploraClient::new(url.as_str())
                    .context(format!("Failed initializing esplora client for url {url}"))?,
            )
        }

        Ok(Actor {
            block_height: 0,
            db,
            config,
            clients,
            current_client_index: 0,
            notifications,
            moon,
        })
    }

    fn get_next_client(&mut self) -> Option<&blockchain::esplora_client::EsploraClient> {
        if self.clients.is_empty() {
            return None;
        }

        let client = &self.clients[self.current_client_index];
        self.current_client_index = (self.current_client_index + 1) % self.clients.len();
        client.into()
    }
}

/// Returns the total amount deposited to the provided [`contract_address`]
///
/// Note: we do not consider spends at this place, meaning, we really just look at all outputs which
/// are deposited into [`contract_address`]
///
/// To get a full view of the tx, you will need to call [`total_amount_spent`] in addition
fn total_amount_deposited(contract_address: &ScriptBuf, tx: &Tx) -> u64 {
    tx.vout
        .iter()
        .filter_map(|vout| {
            if &vout.scriptpubkey == contract_address {
                Some(vout.value)
            } else {
                None
            }
        })
        .sum::<u64>()
}

/// Returns the total amount spent from the provided [`contract_address`]
///
/// Note: we do not consider deposits at this place, meaning, we really just look at all inputs
/// which are spending [`contract_address`]
///
/// To get a full view of the tx, you will need to call [`total_amount_deposited`] in addition
fn total_amount_spent(contract_address: &ScriptBuf, tx: &Tx) -> u64 {
    let spent_amount = tx
        .vin
        .iter()
        .filter_map(|vin| match &vin.prevout {
            None => None,
            Some(prevout) => {
                if &prevout.scriptpubkey == contract_address {
                    Some(prevout.value)
                } else {
                    None
                }
            }
        })
        .sum::<u64>();

    spent_amount
}

impl xtra::Actor for Actor {
    type Stop = anyhow::Error;

    async fn started(&mut self, mailbox: &Mailbox<Self>) -> Result<()> {
        // setting to 0 to ensure we will sync during startup
        self.block_height = 0;

        let sync_interval = self.config.btsieve_sync_interval;

        // if this is set, we will fetch transactions for ALL contracts
        let reset_txes = self.config.reset_tx_view_in_db;

        let contracts = db::contracts::load_all(&self.db).await?;
        tokio::spawn({
            let actor = mailbox.address();
            async move {
                if reset_txes {
                    tracing::info!(
                        number_of_contracts = contracts.len(),
                        "Getting tx for all contracts"
                    );

                    for contract in &contracts {
                        if let Some(contract_address) = &contract.contract_address {
                            if let Err(e) = actor
                                .send(CheckAddressStatus {
                                    contract_id: contract.id.clone(),
                                    contract_address: contract_address.clone().assume_checked(),
                                })
                                .await
                                .expect("actor to be alive")
                            {
                                tracing::error!(?contract, "Failed to track contract: {e:#}");
                            }
                        }
                    }
                    tracing::info!(
                        number_of_contracts = contracts.len(),
                        "Fetching tx for all contracts done"
                    );
                    panic!("Synced up with blockchain");
                }

                loop {
                    tracing::trace!(
                        target: "btsieve",
                        "Checking tx for blocks"
                    );
                    if let Err(e) = actor
                        .send(CheckBlockHeight)
                        .await
                        .expect("actor to be alive")
                    {
                        tracing::error!("Failed to check for latest block height: {e:#}");
                    }
                    if let Err(e) = actor
                        .send(CheckForApprovedContracts)
                        .await
                        .expect("actor to be alive")
                    {
                        tracing::error!("Failed to check for approved contracts: {e:#}");
                    }
                    tokio::time::sleep(tokio::time::Duration::from_secs(sync_interval)).await;
                }
            }
        });

        Ok(())
    }

    async fn stopped(self) -> Self::Stop {
        anyhow!("Btsieve actor stopped")
    }
}

/// Message to tell the [`crate::mempool::Actor`] to fetch the status of an address.
#[derive(Debug)]
pub struct CheckBlockHeight;

impl xtra::Handler<CheckBlockHeight> for Actor {
    type Return = Result<()>;

    async fn handle(&mut self, _: CheckBlockHeight, ctx: &mut xtra::Context<Self>) -> Self::Return {
        let client = self
            .get_next_client()
            .ok_or(anyhow!("no client configured"))?;

        let latest_tip = client.get_block_tip_height().await?;

        tracing::trace!(
            target: "btsieve",
            latest_tip = latest_tip,
            "Fetched latest height"
        );

        if self.block_height != latest_tip {
            tracing::debug!(
                last_known_height = self.block_height,
                latest_tip = latest_tip,
                "Found a new block"
            );

            let actor = ctx.mailbox().address();

            let contracts = db::contracts::load_contracts_to_watch(&self.db).await?;
            tracing::debug!(
                target: "btsieve",
                number_of_contracts = contracts.len(),
                "Checking tx for contracts"
            );
            tokio::spawn(async move {
                for contract in contracts {
                    let contract_address = match contract.contract_address {
                        Some(ref contract_address) => contract_address,
                        None => {
                            tracing::error!(
                                contract_id = contract.id,
                                "Cannot track pending contract without contract address"
                            );
                            continue;
                        }
                    };
                    // If we ever want to optimise this actor, this might be the place to start.
                    //
                    // We are sending one message per contract, which can only be processed one by
                    // one. I think the only thing that is being shared (that cannot be
                    // cloned/copied) between these tasks is get_next_client, which could be shared
                    // more efficiently as a Mutex.
                    //
                    // Although it's kind of a feature to throttle these requests, to avoid rate
                    // limits.
                    if let Err(err) = actor
                        .send(CheckAddressStatus {
                            contract_id: contract.id.clone(),
                            contract_address: contract_address.clone().assume_checked(),
                        })
                        .await
                        .expect("actor to be alive")
                    {
                        tracing::error!(
                            contract_id = contract.id,
                            "Failed checking for new transactions for contract {err:#}"
                        );
                    }
                }
            });

            // last but not least, update our internal block height
            self.block_height = latest_tip;
        }

        Ok(())
    }
}

/// Message to tell the [`crate::mempool::Actor`] to fetch new contracts being funded.
#[derive(Debug)]
pub struct CheckForApprovedContracts;

impl xtra::Handler<CheckForApprovedContracts> for Actor {
    type Return = Result<()>;

    async fn handle(
        &mut self,
        _: CheckForApprovedContracts,
        ctx: &mut xtra::Context<Self>,
    ) -> Self::Return {
        tracing::debug!(
            last_known_height = self.block_height,
            "Checking for approved contracts"
        );

        let actor = ctx.mailbox().address();

        let contracts = db::contracts::load_approved_contracts(&self.db).await?;
        tracing::debug!(
            target: "btsieve",
            number_of_contracts = contracts.len(),
            "Checking tx for approved contracts"
        );
        tokio::spawn(async move {
            for contract in contracts {
                let contract_address = match contract.contract_address {
                    Some(ref contract_address) => contract_address,
                    None => {
                        tracing::error!(
                            contract_id = contract.id,
                            "Cannot track pending contract without contract address"
                        );
                        continue;
                    }
                };
                if let Err(err) = actor
                    .send(CheckAddressStatus {
                        contract_id: contract.id.clone(),
                        contract_address: contract_address.clone().assume_checked(),
                    })
                    .await
                    .expect("actor to be alive")
                {
                    tracing::error!(
                        contract_id = contract.id,
                        "Failed checking for new transactions for approved contract {err:#}"
                    );
                }
            }
        });

        Ok(())
    }
}

/// Message to tell the [`crate::mempool::Actor`] to fetch the status of an address.
#[derive(Debug)]
pub struct CheckAddressStatus {
    contract_id: String,
    contract_address: Address,
}

impl xtra::Handler<CheckAddressStatus> for Actor {
    type Return = Result<()>;

    async fn handle(
        &mut self,
        msg: CheckAddressStatus,
        _: &mut xtra::Context<Self>,
    ) -> Self::Return {
        tracing::trace!(target: "btsieve",
            contract_id = msg.contract_id,
            address = msg.contract_address.to_string(),
            "Checking address status");

        let contract_address = msg.contract_address.script_pubkey();
        let contract_id = msg.contract_id;

        // get all txs we are aware of
        let known_txs =
            db::contract_collateral_transactions::get_by_contract_id(&self.db, &contract_id)
                .await?;
        // next, we filter for only the unconfirmed one, we trust that a once confirmed tx does not
        // get unconfirmed
        let known_confirmed_txs = known_txs
            .iter()
            .filter(|tx| tx.block_time.is_some() && tx.block_height.is_some())
            .collect::<Vec<_>>();

        let client = self
            .get_next_client()
            .ok_or(anyhow!("no client configured"))?;

        // get all addresses for a transaction
        let new_txes = client.get_address_txes(&msg.contract_address, None).await?;

        // if we know all new transactions already, we don't have to process them again.
        if new_txes.iter().all(|tx| {
            known_confirmed_txs
                .iter()
                .any(|known_tx| known_tx.tx_id == tx.txid.to_string())
        }) {
            tracing::trace!(
                target: "btsieve",
                contract_id,
                "All txes known for contract. No need to update db"
            );
            return Ok(());
        }

        let mut all_unconfirmed = true;

        // convert for our internal tx structure and calculate amoutn deposited and spent
        let txs = new_txes
            .into_iter()
            .map(|tx| {
                // we want to know if all txes are unconfirmed. If they are all unconfirmed, we are
                // likely in funding mode it's more efficient if we do it here than
                // iterating again over the list of txes
                all_unconfirmed = all_unconfirmed && tx.confirmation_time().is_none();

                let amount_spent = total_amount_spent(&contract_address, &tx);
                let amount_deposited = total_amount_deposited(&contract_address, &tx);

                let now = OffsetDateTime::now_utc();
                db::contract_collateral_transactions::ContractTransactionInsert {
                    tx_id: tx.txid,
                    amount_deposited: amount_deposited as i64,
                    amount_spent: amount_spent as i64,
                    block_time: tx.confirmation_time().map(|t| {
                        OffsetDateTime::from_unix_timestamp(t.timestamp as i64).unwrap_or(now)
                    }),
                    block_height: tx.confirmation_time().map(|t| t.height),
                    contract_id: contract_id.clone(),
                }
            })
            .collect::<Vec<_>>();

        // update our internal tx tracker db

        let current_balance = txs
            .iter()
            .map(|tx| tx.amount_deposited - tx.amount_spent)
            .sum::<i64>();

        if let Err(err) = db::contract_collateral_transactions::bulk_insert(&self.db, txs).await {
            tracing::error!(
                contract_id = %contract_id,
                current_balance,
                "Failed inserting transactions {err:#}")
        }

        let current_balance = if current_balance < 0 {
            tracing::error!(
                contract_id = %contract_id,
                current_balance,
                "Error in calculating balance, it cannot be negative. We are ignoring this update");

            return Ok(());
        } else {
            current_balance as u64
        };

        tracing::info!(contract_id, current_balance, "Updating collateral");
        // update contract and send notification
        if let Err(error) = update_collateral(
            &self.db,
            self.config.clone(),
            self.notifications.clone(),
            self.moon.clone(),
            contract_id.as_str(),
            current_balance,
            all_unconfirmed,
        )
        .await
        {
            tracing::error!(
                contract_id = %contract_id,
                new_balance = %current_balance,
                "Failed update contract: {error:#}");
        }

        Ok(())
    }
}

async fn update_collateral(
    db: &Pool<Postgres>,
    config: Config,
    notifications: Arc<Notifications>,
    moon: Arc<moon::Manager>,
    contract_id: &str,
    confirmed_collateral_sats: u64,
    all_unconfirmed: bool,
) -> Result<()> {
    // As a side-effect, here we are checking if the contract address was reused: if this is a
    // newly approved contract (still in the `Requested` state) and the address already has
    // money in it, this contract address most likely belongs to a different contract already!
    // Thus we cannot proceed safely.
    tracing::trace!(
        contract_id = %contract_id,
        new_balance = %confirmed_collateral_sats,
        "Updating contract collateral and status");

    let (contract, is_newly_confirmed) = crate::contract_update_collateral::update_collateral(
        db,
        contract_id,
        confirmed_collateral_sats,
        all_unconfirmed,
    )
    .await?;

    if is_newly_confirmed {
        notifications.send_collateral_seen(contract_id).await;

        if let Err(err) = send_loan_collateralized_email_to_lender(
            db,
            &contract.id,
            &contract.lender_id,
            &contract.borrower_id,
            notifications.clone(),
        )
        .await
        {
            tracing::error!(
                contract_id = contract.id,
                "Failed to notify lender about collateralized contract: {err:?}"
            );
        }

        let loan_offer = db::loan_offers::loan_by_id(db, &contract.loan_id)
            .await?
            .context("Missing loan")?;

        // If the loan is paid out indirectly, it means that we don't need to wait for the
        // lender to self-report the disbursement. We can assume that the loan is automatically
        // paid out as soon as the collateral is confirmed.
        //
        // We do this in two steps (first `CollateralConfirmed`, then `PrincipalGiven`) so that
        // the contract status log doesn't look odd.
        if loan_offer.loan_payout == LoanPayout::Indirect {
            mark_as_principal_given(
                db,
                &config,
                &notifications,
                &moon,
                contract_id,
                &contract.lender_id,
                None,
            )
            .await?;
        }
    }

    Ok(())
}

async fn send_loan_collateralized_email_to_lender(
    db: &Pool<Postgres>,
    contract_id: &str,
    lender_id: &str,
    borrower_id: &str,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let contract_emails = db::contract_emails::load_contract_emails(db, contract_id)
        .await
        .context("Failed to check if collateral-funded email was sent")?;

    let borrower = db::borrowers::get_user_by_id(db, borrower_id)
        .await?
        .context("Cannot send collateral-funded notification to unknown borrower")?;

    notifications
        .send_loan_collateralized_borrower(borrower, contract_id)
        .await;

    if !contract_emails.collateral_funded_sent {
        let lender = db::lenders::get_user_by_id(db, lender_id)
            .await?
            .context("Cannot send collateral-funded email to unknown lender")?;

        notifications
            .send_loan_collateralized_lender(lender, contract_id)
            .await;
    }

    Ok(())
}

/// Message to get the outputs with the given collateral address.
#[derive(Debug)]
pub struct GetCollateralOutputs(pub Address<NetworkUnchecked>);

impl xtra::Handler<GetCollateralOutputs> for Actor {
    type Return = Result<Vec<(OutPoint, u64)>>;

    async fn handle(
        &mut self,
        msg: GetCollateralOutputs,
        _: &mut xtra::Context<Self>,
    ) -> Self::Return {
        let address = msg.0.assume_checked();

        let client = self
            .get_next_client()
            .ok_or(anyhow!("no client configured"))?;

        let vec = client.get_address_txes(&address, None).await?;
        let outpoints = vec
            .iter()
            .flat_map(|tx| {
                tx.vout
                    .iter()
                    .enumerate()
                    .filter_map(|(index, vout)| {
                        if vout.scriptpubkey == address.script_pubkey() {
                            Some((
                                OutPoint {
                                    txid: tx.txid,
                                    vout: index as u32,
                                },
                                vout.value,
                            ))
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<(_, _)>>()
            })
            .collect::<Vec<(_, _)>>();

        Ok(outpoints)
    }
}

/// Message to tell the [`Actor`] to post a transaction.
#[derive(Debug)]
pub struct PostTx(pub bitcoin::Transaction);

impl xtra::Handler<PostTx> for Actor {
    type Return = Result<()>;

    async fn handle(&mut self, msg: PostTx, _: &mut xtra::Context<Self>) -> Self::Return {
        let client = self
            .get_next_client()
            .ok_or(anyhow!("no client configured"))?;

        client.post_tx(&msg.0).await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bitcoin::ScriptBuf;
    use esplora_client::Tx;
    use serde_json;

    #[test]
    fn tx_spending_from_address() {
        let contract_script =
            ScriptBuf::from_hex("00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9").unwrap();

        // https://mutinynet.com/tx/7e716e55dbe4b43374ccaa2263be706d4a98388863554b39466088505df42d2d
        let transactions_json = r#"  {"txid": "7e716e55dbe4b43374ccaa2263be706d4a98388863554b39466088505df42d2d","version": 2,"locktime": 0,"vin": [  {    "txid": "2a5133793df954b3719e8550fe561ccccf9b578d4ea06fa441cedc2f5f5b1042",    "vout": 2,    "prevout": {      "scriptpubkey": "00148b0b31783a72afcf1090c4cac3d25e7475bbe30a",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 8b0b31783a72afcf1090c4cac3d25e7475bbe30a",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1q3v9nz7p6w2hu7yyscn9v85j7w36mhcc28ajlsr",      "value": 18962    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "3044022062b0f0b24a3f68b0e28f5f117f5db2f818394b5c52b041e51f672abc3fce36ca022014a1d17eedcb0ae35080cbbd3010c6386a2f54b9de2123b4d8299af482544b4701",      "02a38282a3f46e097d5ff1b4f1f43f0bb2e4d2bcc476e4dbddae93e0f95f18f0e2"    ],    "is_coinbase": false,    "sequence": 4294967293  },  {    "txid": "766035b3d96d4abc12900342c2df2bfb143c5181dfcbe8b1d55a00312f18257a",    "vout": 1,    "prevout": {      "scriptpubkey": "00145500362c1f75179cb35acdd45dac65d0819bebd3",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 5500362c1f75179cb35acdd45dac65d0819bebd3",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1q25qrvtqlw5teev66eh29mtr96zqeh67ncrztht",      "value": 18988    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "304402204890bb655a99f18f49e8bc12138d7b699d9aff72464eaa5da940a94c2c3eb0ff0220362eed63cfb917f31da123fc1c1903ad67fda34d0e0458df628ff84d8760381201",      "03fd325b3f38639e97181b80c88ba2606354a5c70395923b709639821fc86447c7"    ],    "is_coinbase": false,    "sequence": 4294967293  },  {    "txid": "5de7d4782947c8ae054e93050db1a69e5323a79c10d1da295b43ff932eb2cb48",    "vout": 1,    "prevout": {      "scriptpubkey": "0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37",      "value": 15529    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "30440220209450ba9b5dffe16ee0ad881d645e7e4b5674447537f179cead53132fd69d6e022030e138eb111a7aef345abb912e7c7eeabcce1bfbddc5907b605832e0c65a7c5d01",      "021bf9aab98dc211970a8a0ab5d055be2c22ac8cc13a399373ac639d9c965f35e4"    ],    "is_coinbase": false,    "sequence": 4294967293  },  {    "txid": "65c38eb7a1f1a8a707f2713206961e93545b6fe5e82c34c86feee55786314231",    "vout": 1,    "prevout": {      "scriptpubkey": "00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3",      "value": 38000    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "30440220356350de6b9fbf2a160b203493a24b8e00c51c06a14d31e7a4ad239b390f7bca02204e7892183a4f10cacd85fee409447e83756d917a2a3321fa39f840ba69c25b6b01",      "0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"    ],    "is_coinbase": false,    "sequence": 4294967293  }],"vout": [  {    "scriptpubkey": "0020c24b388b15aa65aa4e7535ebe38e41a470384a8c25d99d20e65e17071c501f7a",    "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 c24b388b15aa65aa4e7535ebe38e41a470384a8c25d99d20e65e17071c501f7a",    "scriptpubkey_type": "v0_p2wsh",    "scriptpubkey_address": "tb1qcf9n3zc44fj65nn4xh478rjp53crsj5vyhve6g8xtctsw8zsraaqwdqvut",    "value": 30000  },  {    "scriptpubkey": "00142df21e4489120170400afba151e58d0f2cd9bed3",    "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 2df21e4489120170400afba151e58d0f2cd9bed3",    "scriptpubkey_type": "v0_p2wpkh",    "scriptpubkey_address": "tb1q9hepu3yfzgqhqsq2lws4revdpukdn0knjj58t6",    "value": 61122  }],"size": 678,"weight": 1422,"sigops": 4,"fee": 357,"status": {  "confirmed": true,  "block_height": 2005658,  "block_hash": "000001f81be4f3176521e8eaa3043f56d9ac18f0cc83a7f55e533c14beea9d31",  "block_time": 1744161557} }"#;

        let tx: Tx = serde_json::from_str(transactions_json).unwrap();

        let deposited = total_amount_deposited(&contract_script, &tx);
        let spent = total_amount_spent(&contract_script, &tx);

        assert_eq!(spent, 38000);
        assert_eq!(deposited, 0);
    }
    #[test]
    fn tx_depositing_to_address() {
        let contract_script =
            ScriptBuf::from_hex("00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9").unwrap();

        // https://mutinynet.com/tx/65c38eb7a1f1a8a707f2713206961e93545b6fe5e82c34c86feee55786314231
        let transactions_json = r#"  {"txid": "65c38eb7a1f1a8a707f2713206961e93545b6fe5e82c34c86feee55786314231","version": 2,"locktime": 0,"vin": [  {    "txid": "73187ee2492c4e717d40fffa4865ce890e47132d47df9adeeb9ca355093ef00a",    "vout": 1,    "prevout": {      "scriptpubkey": "0014f96f09e42f354ca8a6ab57d2e0b5123d81a22a32",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 f96f09e42f354ca8a6ab57d2e0b5123d81a22a32",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1ql9hsnep0x4x23f4t2lfwpdgj8kq6y23j68xnw8",      "value": 426940    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "304402206ac9482a96d778c2794cc108d8b3004873574c5975b6acb391197b11db162ad9022039b15f1237c190ee5f47ef63bfe1612b0d4d2552ea7cdf4f5d8274692c7442b901",      "0338d1d6c2e2c8dd3207b54d7c078d69ff33ba8175af0935c9cb43c09e52435ee7"    ],    "is_coinbase": false,    "sequence": 4294967293  }],"vout": [  {    "scriptpubkey": "0014aaa30e6f3c5b9e18596be4b37c79d54bc743933e",    "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 aaa30e6f3c5b9e18596be4b37c79d54bc743933e",    "scriptpubkey_type": "v0_p2wpkh",    "scriptpubkey_address": "tb1q423sumeutw0pskttujehc7w4f0r58ye7hm30r3",    "value": 388799  },  {    "scriptpubkey": "00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",    "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",    "scriptpubkey_type": "v0_p2wpkh",    "scriptpubkey_address": "tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3",    "value": 38000  }],"size": 222,"weight": 561,"sigops": 1,"fee": 141,"status": {  "confirmed": true,  "block_height": 2005553,  "block_hash": "0000007b12eb64a57877428ef88a3cd6460141355e091c1cae37ea9ddebe4f9e",  "block_time": 1744158296}}"#;

        let tx: Tx = serde_json::from_str(transactions_json).unwrap();

        let deposited = total_amount_deposited(&contract_script, &tx);
        let spent = total_amount_spent(&contract_script, &tx);

        assert_eq!(deposited, 38000);
        assert_eq!(spent, 0);
    }
    #[test]
    fn tx_depositing_to_and_spending_from_address() {
        let contract_script =
            ScriptBuf::from_hex("00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9").unwrap();

        // tx: made up
        let transactions_json = r#"{"txid": "7e716e55dbe4b43374ccaa2263be706d4a98388863554b39466088505df42d2d","version": 2,"locktime": 0,"vin": [  {    "txid": "2a5133793df954b3719e8550fe561ccccf9b578d4ea06fa441cedc2f5f5b1042",    "vout": 2,    "prevout": {      "scriptpubkey": "00148b0b31783a72afcf1090c4cac3d25e7475bbe30a",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 8b0b31783a72afcf1090c4cac3d25e7475bbe30a",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1q3v9nz7p6w2hu7yyscn9v85j7w36mhcc28ajlsr",      "value": 18962    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "3044022062b0f0b24a3f68b0e28f5f117f5db2f818394b5c52b041e51f672abc3fce36ca022014a1d17eedcb0ae35080cbbd3010c6386a2f54b9de2123b4d8299af482544b4701",      "02a38282a3f46e097d5ff1b4f1f43f0bb2e4d2bcc476e4dbddae93e0f95f18f0e2"    ],    "is_coinbase": false,    "sequence": 4294967293  },  {    "txid": "766035b3d96d4abc12900342c2df2bfb143c5181dfcbe8b1d55a00312f18257a",    "vout": 1,    "prevout": {      "scriptpubkey": "00145500362c1f75179cb35acdd45dac65d0819bebd3",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 5500362c1f75179cb35acdd45dac65d0819bebd3",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1q25qrvtqlw5teev66eh29mtr96zqeh67ncrztht",      "value": 18988    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "304402204890bb655a99f18f49e8bc12138d7b699d9aff72464eaa5da940a94c2c3eb0ff0220362eed63cfb917f31da123fc1c1903ad67fda34d0e0458df628ff84d8760381201",      "03fd325b3f38639e97181b80c88ba2606354a5c70395923b709639821fc86447c7"    ],    "is_coinbase": false,    "sequence": 4294967293  },  {    "txid": "5de7d4782947c8ae054e93050db1a69e5323a79c10d1da295b43ff932eb2cb48",    "vout": 1,    "prevout": {      "scriptpubkey": "0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37",      "value": 15529    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "30440220209450ba9b5dffe16ee0ad881d645e7e4b5674447537f179cead53132fd69d6e022030e138eb111a7aef345abb912e7c7eeabcce1bfbddc5907b605832e0c65a7c5d01",      "021bf9aab98dc211970a8a0ab5d055be2c22ac8cc13a399373ac639d9c965f35e4"    ],    "is_coinbase": false,    "sequence": 4294967293  },  {    "txid": "65c38eb7a1f1a8a707f2713206961e93545b6fe5e82c34c86feee55786314231",    "vout": 1,    "prevout": {      "scriptpubkey": "00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",      "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",      "scriptpubkey_type": "v0_p2wpkh",      "scriptpubkey_address": "tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3",      "value": 38000    },    "scriptsig": "",    "scriptsig_asm": "",    "witness": [      "30440220356350de6b9fbf2a160b203493a24b8e00c51c06a14d31e7a4ad239b390f7bca02204e7892183a4f10cacd85fee409447e83756d917a2a3321fa39f840ba69c25b6b01",      "0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"    ],    "is_coinbase": false,    "sequence": 4294967293  }],"vout": [  {    "scriptpubkey": "0020c24b388b15aa65aa4e7535ebe38e41a470384a8c25d99d20e65e17071c501f7a",    "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 c24b388b15aa65aa4e7535ebe38e41a470384a8c25d99d20e65e17071c501f7a",    "scriptpubkey_type": "v0_p2wsh",    "scriptpubkey_address": "tb1qcf9n3zc44fj65nn4xh478rjp53crsj5vyhve6g8xtctsw8zsraaqwdqvut",    "value": 30000  },  {    "scriptpubkey": "00142df21e4489120170400afba151e58d0f2cd9bed3",    "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 2df21e4489120170400afba151e58d0f2cd9bed3",    "scriptpubkey_type": "v0_p2wpkh",    "scriptpubkey_address": "tb1q9hepu3yfzgqhqsq2lws4revdpukdn0knjj58t6",    "value": 25122  },  {    "scriptpubkey": "00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",    "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9",    "scriptpubkey_type": "v0_p2wpkh",    "scriptpubkey_address": "tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3",    "value": 36000  }],"size": 678,"weight": 1422,"sigops": 4,"fee": 357,"status": {  "confirmed": true,  "block_height": 2005658,  "block_hash": "000001f81be4f3176521e8eaa3043f56d9ac18f0cc83a7f55e533c14beea9d31",  "block_time": 1744161557}}"#;

        let tx: Tx = serde_json::from_str(transactions_json).unwrap();

        let deposited = total_amount_deposited(&contract_script, &tx);
        let spent = total_amount_spent(&contract_script, &tx);

        assert_eq!(deposited, 36000);
        assert_eq!(spent, 38000);
    }

    #[test]
    fn test_total_amounts_with_real_data() {
        // Contract address: tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3
        // Script: 00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9
        let contract_script =
            ScriptBuf::from_hex("00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9").unwrap();

        // Full JSON data from Esplora API
        // https://mutinynet.com/address/tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3
        let transactions_json = r#"[{"txid":"7e716e55dbe4b43374ccaa2263be706d4a98388863554b39466088505df42d2d","version":2,"locktime":0,"vin":[{"txid":"2a5133793df954b3719e8550fe561ccccf9b578d4ea06fa441cedc2f5f5b1042","vout":2,"prevout":{"scriptpubkey":"00148b0b31783a72afcf1090c4cac3d25e7475bbe30a","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 8b0b31783a72afcf1090c4cac3d25e7475bbe30a","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1q3v9nz7p6w2hu7yyscn9v85j7w36mhcc28ajlsr","value":18962},"scriptsig":"","scriptsig_asm":"","witness":["3044022062b0f0b24a3f68b0e28f5f117f5db2f818394b5c52b041e51f672abc3fce36ca022014a1d17eedcb0ae35080cbbd3010c6386a2f54b9de2123b4d8299af482544b4701","02a38282a3f46e097d5ff1b4f1f43f0bb2e4d2bcc476e4dbddae93e0f95f18f0e2"],"is_coinbase":false,"sequence":4294967293},{"txid":"766035b3d96d4abc12900342c2df2bfb143c5181dfcbe8b1d55a00312f18257a","vout":1,"prevout":{"scriptpubkey":"00145500362c1f75179cb35acdd45dac65d0819bebd3","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5500362c1f75179cb35acdd45dac65d0819bebd3","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1q25qrvtqlw5teev66eh29mtr96zqeh67ncrztht","value":18988},"scriptsig":"","scriptsig_asm":"","witness":["304402204890bb655a99f18f49e8bc12138d7b699d9aff72464eaa5da940a94c2c3eb0ff0220362eed63cfb917f31da123fc1c1903ad67fda34d0e0458df628ff84d8760381201","03fd325b3f38639e97181b80c88ba2606354a5c70395923b709639821fc86447c7"],"is_coinbase":false,"sequence":4294967293},{"txid":"5de7d4782947c8ae054e93050db1a69e5323a79c10d1da295b43ff932eb2cb48","vout":1,"prevout":{"scriptpubkey":"0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37","value":15529},"scriptsig":"","scriptsig_asm":"","witness":["30440220209450ba9b5dffe16ee0ad881d645e7e4b5674447537f179cead53132fd69d6e022030e138eb111a7aef345abb912e7c7eeabcce1bfbddc5907b605832e0c65a7c5d01","021bf9aab98dc211970a8a0ab5d055be2c22ac8cc13a399373ac639d9c965f35e4"],"is_coinbase":false,"sequence":4294967293},{"txid":"65c38eb7a1f1a8a707f2713206961e93545b6fe5e82c34c86feee55786314231","vout":1,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":38000},"scriptsig":"","scriptsig_asm":"","witness":["30440220356350de6b9fbf2a160b203493a24b8e00c51c06a14d31e7a4ad239b390f7bca02204e7892183a4f10cacd85fee409447e83756d917a2a3321fa39f840ba69c25b6b01","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"0020c24b388b15aa65aa4e7535ebe38e41a470384a8c25d99d20e65e17071c501f7a","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_32 c24b388b15aa65aa4e7535ebe38e41a470384a8c25d99d20e65e17071c501f7a","scriptpubkey_type":"v0_p2wsh","scriptpubkey_address":"tb1qcf9n3zc44fj65nn4xh478rjp53crsj5vyhve6g8xtctsw8zsraaqwdqvut","value":30000},{"scriptpubkey":"00142df21e4489120170400afba151e58d0f2cd9bed3","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 2df21e4489120170400afba151e58d0f2cd9bed3","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1q9hepu3yfzgqhqsq2lws4revdpukdn0knjj58t6","value":61122}],"size":678,"weight":1422,"sigops":4,"fee":357,"status":{"confirmed":true,"block_height":2005658,"block_hash":"000001f81be4f3176521e8eaa3043f56d9ac18f0cc83a7f55e533c14beea9d31","block_time":1744161557}},{"txid":"65c38eb7a1f1a8a707f2713206961e93545b6fe5e82c34c86feee55786314231","version":2,"locktime":0,"vin":[{"txid":"73187ee2492c4e717d40fffa4865ce890e47132d47df9adeeb9ca355093ef00a","vout":1,"prevout":{"scriptpubkey":"0014f96f09e42f354ca8a6ab57d2e0b5123d81a22a32","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 f96f09e42f354ca8a6ab57d2e0b5123d81a22a32","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1ql9hsnep0x4x23f4t2lfwpdgj8kq6y23j68xnw8","value":426940},"scriptsig":"","scriptsig_asm":"","witness":["304402206ac9482a96d778c2794cc108d8b3004873574c5975b6acb391197b11db162ad9022039b15f1237c190ee5f47ef63bfe1612b0d4d2552ea7cdf4f5d8274692c7442b901","0338d1d6c2e2c8dd3207b54d7c078d69ff33ba8175af0935c9cb43c09e52435ee7"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"0014aaa30e6f3c5b9e18596be4b37c79d54bc743933e","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 aaa30e6f3c5b9e18596be4b37c79d54bc743933e","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1q423sumeutw0pskttujehc7w4f0r58ye7hm30r3","value":388799},{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":38000}],"size":222,"weight":561,"sigops":1,"fee":141,"status":{"confirmed":true,"block_height":2005553,"block_hash":"0000007b12eb64a57877428ef88a3cd6460141355e091c1cae37ea9ddebe4f9e","block_time":1744158296}},{"txid":"9327aaa2e7ff926e975253a5034e2fe20f7ee0e4594aa10545a553361b4025a7","version":2,"locktime":0,"vin":[{"txid":"f7f27858ff056707197d182e88922984ed46193f1f1e9278da3141a546e95ee9","vout":1,"prevout":{"scriptpubkey":"0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37","value":17699},"scriptsig":"","scriptsig_asm":"","witness":["30440220482b607d3dc9ea78cc3ff607f8056a182580471a71e2a59dc2eb67445d8479f502205a519ec1906688abb48ef41c8b78017374af073b992432a7a49398cfa5ae5e5401","021bf9aab98dc211970a8a0ab5d055be2c22ac8cc13a399373ac639d9c965f35e4"],"is_coinbase":false,"sequence":4294967293},{"txid":"8b76df9c43fe12ff2e1422f12b6cb7b24e6ce520be98e5315e9d03c895526762","vout":1,"prevout":{"scriptpubkey":"0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37","value":14740},"scriptsig":"","scriptsig_asm":"","witness":["3044022071eb5bf905894e06837d7b577394b2655e89faf2caac1be8c38710a1e04e2240022060f786e25974ef3b042d11e97a1f49741feca98ffd78887dc46ae52be0f9dbe101","021bf9aab98dc211970a8a0ab5d055be2c22ac8cc13a399373ac639d9c965f35e4"],"is_coinbase":false,"sequence":4294967293},{"txid":"569042c9ff8e8440e0a484154da94804a464b310ac3866fd8873834cc5f83925","vout":1,"prevout":{"scriptpubkey":"0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37","value":17617},"scriptsig":"","scriptsig_asm":"","witness":["3044022005303cdb332dea13a899e86277e4bfd22f9e53ee1c6f6609e12ea2a02a2a3d34022006888be4c180a8193818e8736c2e1cd48e772ec8cbd7080335d56740a232c2e601","021bf9aab98dc211970a8a0ab5d055be2c22ac8cc13a399373ac639d9c965f35e4"],"is_coinbase":false,"sequence":4294967293},{"txid":"f8805937fef77d0d203973bbc80ad0865103f153738e38caea0ed565a4d20b40","vout":0,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":16754},"scriptsig":"","scriptsig_asm":"","witness":["304402200e361ba6b91666177c2abc0a37bddbbed40f49e547235d63c7145e2c588967950220099a32d0848a9ec4b8a8e6bb957ba669368fcd7748a56375703c44bc75be5ea401","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293},{"txid":"a8fc87efeff48d9eed1317da015d06cd26fa5b4935201485fd612eb1597902e7","vout":1,"prevout":{"scriptpubkey":"0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37","value":17642},"scriptsig":"","scriptsig_asm":"","witness":["304402202f79cffb7e5933ad0a1e3276d523771575b57d621c92f1d7669825960227a79f022046f2493d9f91d133bb32a01122b93fb0345f312e286d16798e7c5bd6d8416c2801","021bf9aab98dc211970a8a0ab5d055be2c22ac8cc13a399373ac639d9c965f35e4"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"001417540631cb737650457128d0db090956153ff24f","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 17540631cb737650457128d0db090956153ff24f","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qza2qvvwtwdm9q3t39rgdkzgf2c2nluj0m77645","value":54027},{"scriptpubkey":"0020280691e153c9abadcd3b92fdb2fe1143308940feb1e4c93ae419d12683014c98","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_32 280691e153c9abadcd3b92fdb2fe1143308940feb1e4c93ae419d12683014c98","scriptpubkey_type":"v0_p2wsh","scriptpubkey_address":"tb1q9qrfrc2nex46mnfmjt7m9ls3gvcgjs87k8jvjwhyr8gjdqcpfjvqj8c42r","value":30000}],"size":826,"weight":1693,"sigops":5,"fee":425,"status":{"confirmed":true,"block_height":1991346,"block_hash":"00000004e29c0ca481cf7134bad0135c0d5fa90698da1b4e4a82638bd8f1d5aa","block_time":1743717738}},{"txid":"f8805937fef77d0d203973bbc80ad0865103f153738e38caea0ed565a4d20b40","version":2,"locktime":0,"vin":[{"txid":"b074918c1a940bce37633169fad38cb3ec5cb6e1c97e73d51e830478d8b1b66a","vout":0,"prevout":{"scriptpubkey":"0020e97988415f0a45f8cde90736ffac3e9f9553d8dc755c28a8bf96cdbbac697861","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_32 e97988415f0a45f8cde90736ffac3e9f9553d8dc755c28a8bf96cdbbac697861","scriptpubkey_type":"v0_p2wsh","scriptpubkey_address":"tb1qa9ucss2lpfzl3n0fqum0ltp7n7248kxuw4wz329ljmxmhtrf0psswygpwq","value":34654},"scriptsig":"","scriptsig_asm":"","witness":["","304402202e1b58d9408a2166d7a2da081b7333639f4cd0a7e08ce7dd232c8c78d07c3c6102202e869db6d15864dbb2e31ad2f006858c35a9da5933cd2135a3adefa5110f893a01","3045022100a070cea0cda6465634877c8d4ba1cf4cd527c2c7834345bd399330c0e11925c702207732098a64f78ac5fb06a245d7c49082b0efd5221a6843c3cf8bc9440fcbb1ac01","522102fb1b8b7d0d2c97c23d75ff54a2ca82b83097d8adcbb35c0347050c8aaf64e14a21020b2a49088f94710a0370bda6333bd4f0d20a0b79c964750a300ca1512a158b002103b1af1bd90603145b92a9826421a06c0d9c2d118810315a38d765f5a69bbf779353ae"],"is_coinbase":false,"sequence":4294967295,"inner_witnessscript_asm":"OP_PUSHNUM_2 OP_PUSHBYTES_33 02fb1b8b7d0d2c97c23d75ff54a2ca82b83097d8adcbb35c0347050c8aaf64e14a OP_PUSHBYTES_33 020b2a49088f94710a0370bda6333bd4f0d20a0b79c964750a300ca1512a158b00 OP_PUSHBYTES_33 03b1af1bd90603145b92a9826421a06c0d9c2d118810315a38d765f5a69bbf7793 OP_PUSHNUM_3 OP_CHECKMULTISIG"}],"vout":[{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":16754}],"size":337,"weight":583,"sigops":3,"fee":17900,"status":{"confirmed":true,"block_height":1980487,"block_hash":"000001a6e0cd1eda6f5097f55167623a4b212f33ecf7ba41acd92556086eed1d","block_time":1743381005}},{"txid":"1bd3a1188deb9b318920afbfc367594c55c36e934040340ebd03abf03bdcc4f1","version":2,"locktime":1855433,"vin":[{"txid":"a0edc71ec10520f55f6c173e29209f40e55ba8db9b8059b7e74e03342da24a1b","vout":0,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":350},"scriptsig":"","scriptsig_asm":"","witness":["3044022055f7794f49f3b4012a32b41de460aeee4dc30586427ec553ba0814357fa8828802203b633c432194a6b8488fddda40a57e9338eb4b98d167b250db0d9582436e429701","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293},{"txid":"3e08dbce85596aa9caa224c7290078b7d46803ca077e3ac8095a89aaa7c1878b","vout":0,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":1000},"scriptsig":"","scriptsig_asm":"","witness":["30440220074f1ded854b0149d4adc993384837db6b1a90afe6685b78029a56b46cf719ca0220597a9f3011dd718088971b5e291ca32c7a04ba24e7ddfe19a8cde2671716e74201","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293},{"txid":"ed93dedb8ad8720f0d02bde741cccdc410d5c0d0fcb4e224ee2b7ca56dbfe5e8","vout":0,"prevout":{"scriptpubkey":"00145853c272b56e5d7faab57c1aab6a9c30ee03d5c0","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5853c272b56e5d7faab57c1aab6a9c30ee03d5c0","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtpfuyu44dewhl2440sd2k65uxrhq84wqksj5kg","value":1766},"scriptsig":"","scriptsig_asm":"","witness":["3044022043f0f6ddc0da5e87cf797353a7238c23be4f20505d97b8b62070881b61820bc20220561f948467304d98461ec2b20fe05f184b320183242ee83e27d70b588eefff2401","0367bdd4c2504d38662bd08a549e7f2711eeefe94bd3a60ea39b7e81d32c9f26b5"],"is_coinbase":false,"sequence":4294967293},{"txid":"72c1f5ee4a1cc510e5e6395f7ff74658300747cf38340653122f42c3de81e445","vout":0,"prevout":{"scriptpubkey":"001427eb8f39911c08015934967688b519dea4ca24be","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 27eb8f39911c08015934967688b519dea4ca24be","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qyl4c7wv3rsyqzkf5jemg3dgem6jv5f97nmn87a","value":109178},"scriptsig":"","scriptsig_asm":"","witness":["30440220693ad873690652a896f4e349b487227221eef85e9f0da242fafadf1a85fcfd1c02205cc8ef27799b5f8fa366919d5fa8b59afcfae58b3ab7999e209b4172563e3e9001","02cf385f37a090d444b96fbca4a36d42731f4d027226cbf03d7c7ce817ef9555da"],"is_coinbase":false,"sequence":4294967293},{"txid":"b7e09ac8e8bd27816632781b72a19fdcd6426c262bc408f833189bafd2b4eec0","vout":0,"prevout":{"scriptpubkey":"00149bdc0654577a0e0edbb32b1dc206826725b9f6bb","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 9bdc0654577a0e0edbb32b1dc206826725b9f6bb","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qn0wqv4zh0g8qakan9vwuyp5zvujmna4my8r6mg","value":2071525},"scriptsig":"","scriptsig_asm":"","witness":["304402200bf461d220f31192ab90a2931df3c9a75b3ee58c8c923568f58a7398edf7094b02202adba8e03c5e2b2679dab515e46090f9578e7c15b6f3c96081c02f5120b96d9601","02f90ac38a1d833ce5f62d814d40c55ced9fb870fb572289ab057ae7f932226876"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"0020cbf23cbd5de842f4196d67c451f75cd0582fe3513a645cd2ac04a42007353f1f","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_32 cbf23cbd5de842f4196d67c451f75cd0582fe3513a645cd2ac04a42007353f1f","scriptpubkey_type":"v0_p2wsh","scriptpubkey_address":"tb1qe0ere02aapp0gxtdvlz9ra6u6pvzlc638fj9e54vqjjzqpe48u0slqju8g","value":2083094},{"scriptpubkey":"0014222367161e9f29e8c8b451daefac8839505be3f5","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 222367161e9f29e8c8b451daefac8839505be3f5","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qyg3kw9s7nu573j9528dwltyg89g9hcl4498fxf","value":100297}],"size":826,"weight":1693,"sigops":5,"fee":428,"status":{"confirmed":true,"block_height":1855435,"block_hash":"00000074e88d21f73f704c047f9f42b1cf997684a18781095ebfaf75db063530","block_time":1739501446}},{"txid":"3e08dbce85596aa9caa224c7290078b7d46803ca077e3ac8095a89aaa7c1878b","version":1,"locktime":0,"vin":[{"txid":"9714c9b3673801869c9e1e412d7fe917e5b033136c0c19baa991b68ca75c8940","vout":0,"prevout":{"scriptpubkey":"51209af9bd4f6eda72a020415bd95ec055f6c926f0ecb48a9a31d9548b7cba2c2d5e","scriptpubkey_asm":"OP_PUSHNUM_1 OP_PUSHBYTES_32 9af9bd4f6eda72a020415bd95ec055f6c926f0ecb48a9a31d9548b7cba2c2d5e","scriptpubkey_type":"v1_p2tr","scriptpubkey_address":"tb1pntum6nmwmfe2qgzpt0v4asz47myjdu8vkj9f5vwe2j9hew3v940qr8vjhx","value":99865},"scriptsig":"","scriptsig_asm":"","witness":["74f6ab0058249327f6f8f7ad3108d501fc3ab1fa00fc8a19d5bd9fda4287546901fab348e287b841d701639a104c63006a295027386eb3a885fb1de4156cfc1e"],"is_coinbase":false,"sequence":4294967295}],"vout":[{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":1000},{"scriptpubkey":"512069a583ca5038aa39910fef56468d8f85f1f1030998d8f8f0f0e0265af14be3e0","scriptpubkey_asm":"OP_PUSHNUM_1 OP_PUSHBYTES_32 69a583ca5038aa39910fef56468d8f85f1f1030998d8f8f0f0e0265af14be3e0","scriptpubkey_type":"v1_p2tr","scriptpubkey_address":"tb1pdxjc8jjs8z4rnyg0aatydrv0shclzqcfnrv03u8suqn94u2tu0sq3rmj8u","value":98721}],"size":193,"weight":568,"sigops":0,"fee":144,"status":{"confirmed":true,"block_height":1669681,"block_hash":"00000064569d20d470991d8d5848dc4d88db60f9a1fdb88425ba1d739b1ca6d7","block_time":1733732490}},{"txid":"a0edc71ec10520f55f6c173e29209f40e55ba8db9b8059b7e74e03342da24a1b","version":2,"locktime":1649527,"vin":[{"txid":"95f14f7d5aa7e1d568973cf2e429ebd929a3697ba6a8c829125a8ccdb0b62787","vout":0,"prevout":{"scriptpubkey":"00144e63caba8c425db91bb1355b6715aeadc38127ba","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 4e63caba8c425db91bb1355b6715aeadc38127ba","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qfe3u4w5vgfwmjxa3x4dkw9dw4hpczfa6n8dq6h","value":205873},"scriptsig":"","scriptsig_asm":"","witness":["3044022021bf7f187c41a99b4bc084325c3d39ac48e91b298638a06b9788f9e84a25967f02200ae72f0ab07a1dc8f1553ef5331a3fe4cb2bb60ae2767d3b9b4266abb259980f01","03c331015bc71f1fee47a719029e367d5050021d4830c49e53d58c87ef3212d3ed"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":350},{"scriptpubkey":"00140e41a35028a05ffdd12adf3947d6ea44b825fc4c","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 0e41a35028a05ffdd12adf3947d6ea44b825fc4c","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qpeq6x5pg5p0lm5f2muu504h2gjuztlzvz25cm6","value":205382}],"size":222,"weight":561,"sigops":1,"fee":141,"status":{"confirmed":true,"block_height":1649528,"block_hash":"00000033fe1d020df6e5a17ae4df3c1258ad9fd8c3dcb8018e2907ad682adc18","block_time":1733105091}},{"txid":"e21c971517c34b16a0445ff9bea0e310d137ab2ef60eb6ae14a4f067b04e58c7","version":2,"locktime":1635700,"vin":[{"txid":"c4da5b8fdd094f5ad9992ea476108771d2a99bc8639c639e38d27632d54a2c5c","vout":1,"prevout":{"scriptpubkey":"00148dc9a2522b9bd74444f937f217ed436e89174b36","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 8dc9a2522b9bd74444f937f217ed436e89174b36","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1q3hy6y53tn0t5g38exlep0m2rd6y3wjekq6penv","value":113460},"scriptsig":"","scriptsig_asm":"","witness":["304402200cb0e41f2f764f55b1acef4f8276f58659675f5b85369acae711108284a54d350220154397f1a0b5c7905328d79716c8332aa6c60f4b4a6361923048a21f9d3d0fcf01","02a2aa95d851f9dcebf613a5fea668cf9b8ceb67774df82f2d29c04aa626f826e5"],"is_coinbase":false,"sequence":4294967293},{"txid":"f7cd87e2588e202d4649bb3940e4d619b6677a6140842e54c34a230d2fd55a16","vout":1,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":1000},"scriptsig":"","scriptsig_asm":"","witness":["304402204017428729380403500cfa8cbbf6038577789c7697c2c2fdd1b154f9d2bb325202206544be73d389aef78b3e83c00c78888a18be399ee4180951015a46253f7f6b6c01","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293},{"txid":"26bc69b6cf3af4becb2555d106b31720794cc19042b0dd1bffdf49984677ba49","vout":1,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":10000},"scriptsig":"","scriptsig_asm":"","witness":["304402206914d87ad7048d53284dcee181df7b4d5c9b0ed85701c5acdcb0ef0025cbd099022025204caccf0fe0bcd2772bf04b1a6f7ce6f315cd304112c557c66137b3cfb0c301","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"0014741694eef2edcfde17f792beb0fa1bad0b6b4b36","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 741694eef2edcfde17f792beb0fa1bad0b6b4b36","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qwstffmhjah8au9lhj2ltp7sm459kkjekjxqt9g","value":104172},{"scriptpubkey":"002048832497189814e386e44ffb81552aa3656caaef7ecd02a6884de567892c9575","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_32 48832497189814e386e44ffb81552aa3656caaef7ecd02a6884de567892c9575","scriptpubkey_type":"v0_p2wsh","scriptpubkey_address":"tb1qfzpjf9ccnq2w8phyflacz4f25djke2h00mxs9f5gfhjk0zfvj46stk65d0","value":20000}],"size":530,"weight":1151,"sigops":3,"fee":288,"status":{"confirmed":true,"block_height":1635701,"block_hash":"00000044e5b51d89f8e258fea083b620e0e543e5f15c15fd85bf4397e20a17b9","block_time":1732673573}},{"txid":"f7cd87e2588e202d4649bb3940e4d619b6677a6140842e54c34a230d2fd55a16","version":1,"locktime":0,"vin":[{"txid":"26bc69b6cf3af4becb2555d106b31720794cc19042b0dd1bffdf49984677ba49","vout":0,"prevout":{"scriptpubkey":"51202bb82e882dc75d6c7decf10d7a6305195d24b52a7a90e1eea7564317bc1f8246","scriptpubkey_asm":"OP_PUSHNUM_1 OP_PUSHBYTES_32 2bb82e882dc75d6c7decf10d7a6305195d24b52a7a90e1eea7564317bc1f8246","scriptpubkey_type":"v1_p2tr","scriptpubkey_address":"tb1p9wuzazpdcawkcl0v7yxh5cc9r9wjfdf202gwrm482ep300qlsfrqqgfvvf","value":9850846526},"scriptsig":"","scriptsig_asm":"","witness":["c2c3aca842ad6225422bc1f7cc924a2a8788ec5eda85278e5b81bad2f0a0c8d2ad8cc7cd5f6d9520b7477397be9c3e369bf22f6db4084a7f422dc4d8b84876d3"],"is_coinbase":false,"sequence":4294967295}],"vout":[{"scriptpubkey":"51202ac65a3e2c7e3a82ca4587469d90c3628e58b56a255543f52dbe167f21c81e6b","scriptpubkey_asm":"OP_PUSHNUM_1 OP_PUSHBYTES_32 2ac65a3e2c7e3a82ca4587469d90c3628e58b56a255543f52dbe167f21c81e6b","scriptpubkey_type":"v1_p2tr","scriptpubkey_address":"tb1p9tr9503v0cag9jj9sarfmyxrv2893dt2y4258afdhct87gwgre4sjxg5dl","value":9850845382},{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":1000}],"size":193,"weight":568,"sigops":0,"fee":144,"status":{"confirmed":true,"block_height":1621964,"block_hash":"0000011fa023ffadbabe84478ba662f29f0264437c98e8d6f165a94427dbc61b","block_time":1732241166}},{"txid":"26bc69b6cf3af4becb2555d106b31720794cc19042b0dd1bffdf49984677ba49","version":1,"locktime":0,"vin":[{"txid":"0dad81cb8ffa68f8350b84eb05f9165accd9781f82d2d1ce3dcef8d58f11f8d4","vout":1,"prevout":{"scriptpubkey":"51204221eca16086e9bd22705686fd72b02f490cb934e7a0456cd4996b0443cc6e59","scriptpubkey_asm":"OP_PUSHNUM_1 OP_PUSHBYTES_32 4221eca16086e9bd22705686fd72b02f490cb934e7a0456cd4996b0443cc6e59","scriptpubkey_type":"v1_p2tr","scriptpubkey_address":"tb1pggs7egtqsm5m6gns26r06u4s9aysewf5u7sy2mx5n94sgs7vdevs75pazg","value":9850856670},"scriptsig":"","scriptsig_asm":"","witness":["fc6e7c1aac7024dfdd3d88cf301279c55106af1dcd909e3269a7fe979022d2b00dd5869b8d87a6d0a826f38676ab20185ed7af1bdf49a2c337a895fe9dcaa48f"],"is_coinbase":false,"sequence":4294967295}],"vout":[{"scriptpubkey":"51202bb82e882dc75d6c7decf10d7a6305195d24b52a7a90e1eea7564317bc1f8246","scriptpubkey_asm":"OP_PUSHNUM_1 OP_PUSHBYTES_32 2bb82e882dc75d6c7decf10d7a6305195d24b52a7a90e1eea7564317bc1f8246","scriptpubkey_type":"v1_p2tr","scriptpubkey_address":"tb1p9wuzazpdcawkcl0v7yxh5cc9r9wjfdf202gwrm482ep300qlsfrqqgfvvf","value":9850846526},{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":10000}],"size":193,"weight":568,"sigops":0,"fee":144,"status":{"confirmed":true,"block_height":1621963,"block_hash":"0000032172f4460af22498942c180426d60cfc7be4a12501fd65a97f7f2586d1","block_time":1732241135}},{"txid":"0011e718e02c83507557073aa751204436f1a65857de4b87b9672898a494a55f","version":2,"locktime":1602025,"vin":[{"txid":"5d07fc9570361dd9da4fbd9dd963818e1b84ac83349bb851ea7fa0beadc68f33","vout":0,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":2373},"scriptsig":"","scriptsig_asm":"","witness":["304402204001e7bc2bebf8609ce244c595524f3650dbf3656b4f2027d80f5fb7fa46c178022026051d96e8e327a7965628f511ce0ea85cae2905f75c31c0c740885bab5cf1c901","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293},{"txid":"83ab571d53116660f86b71a824ec90b44c79cefd73ef3eec6897893e7e291ffc","vout":0,"prevout":{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":3827586},"scriptsig":"","scriptsig_asm":"","witness":["3043021f238d55a618b1a8eb1c3969e1802478f8d7769c02584a43da235430e1e0a45002202c1dfe066c9b514d09be5fc391473582d40961c693c429d73df07b5035ff04b801","0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"0014dc0b42a765e4ed9396f9379ea6d926007b70f31a","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 dc0b42a765e4ed9396f9379ea6d926007b70f31a","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qms959fm9unke89hex702dkfxqpahpuc6y4hdww","value":381461},{"scriptpubkey":"0020dac5acdeb613914297f4f9826adc73608670a830f4dd58887b5db7a705646bad","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_32 dac5acdeb613914297f4f9826adc73608670a830f4dd58887b5db7a705646bad","scriptpubkey_type":"v0_p2wsh","scriptpubkey_address":"tb1qmtz6eh4kzwg599l5lxpx4hrnvzr8p2ps7nw43zrmtkm6wptydwksy2828r","value":3448275}],"size":381,"weight":879,"sigops":2,"fee":223,"status":{"confirmed":true,"block_height":1602026,"block_hash":"000000d2a0d1639ac9cf67cf4deb8529fc4deee0bf8f6d0a9ae1f289b21b3aaa","block_time":1731620800}},{"txid":"83ab571d53116660f86b71a824ec90b44c79cefd73ef3eec6897893e7e291ffc","version":2,"locktime":1600141,"vin":[{"txid":"8880ed0102409666a252be5eddd2b28f1fc030e16ff16f1893b8cc368ced211a","vout":0,"prevout":{"scriptpubkey":"0014bb44aec15ee8e4f58303eda401c191851f9347e3","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 bb44aec15ee8e4f58303eda401c191851f9347e3","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qhdz2as27arj0tqcrakjqrsv3s50ex3lrf707aw","value":10000000},"scriptsig":"","scriptsig_asm":"","witness":["304402204fcb1d5b719ff54e2fd14e2d378ee91bbe9090b2b1377fc5c271d6aa7e8d9e66022076b95236243fbb2a34a4aa0480a04eb978c37694e2ea90e1c8c0c873f4ab2e4201","035ad6600af9bea76c0ce32dab9ce6539e4646b7aa6dd7b3ce4a411b867dc59da2"],"is_coinbase":false,"sequence":4294967293}],"vout":[{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":3827586},{"scriptpubkey":"00145d953c90e49d1eb3eab9e5358e20c500a410b191","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5d953c90e49d1eb3eab9e5358e20c500a410b191","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtk2ney8yn50t864eu56cugx9qzjppvv3rtayuh","value":6172272}],"size":222,"weight":561,"sigops":1,"fee":142,"status":{"confirmed":true,"block_height":1600143,"block_hash":"000002f160bb4fdbc1231b2192a2c7cfc5e1072fd8835979f3d2517787673709","block_time":1731562314}},{"txid":"5d07fc9570361dd9da4fbd9dd963818e1b84ac83349bb851ea7fa0beadc68f33","version":2,"locktime":0,"vin":[{"txid":"3db960d996f60280aa54f1305c8b37a8025bc3fa5b4bd5ba7bf84d8e1e64b66c","vout":0,"prevout":{"scriptpubkey":"0020e0286ad037ab65bd7a3621c5cad0f86a1989398d561c6c603a8a573e62d15c33","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_32 e0286ad037ab65bd7a3621c5cad0f86a1989398d561c6c603a8a573e62d15c33","scriptpubkey_type":"v0_p2wsh","scriptpubkey_address":"tb1quq5x45ph4djm673ky8zu458cdgvcjwvd2cwxccp63ftnuck3tses49rra2","value":3139},"scriptsig":"","scriptsig_asm":"","witness":["","3045022100abf5faebe301e9398a5dc381db8e881490b928b7a978e53bbe2ac42ad023b47d0220321c17645e0e876d2f3d347a217b64cb29414691b48377029b63738b641e4b6601","304402200b313578a3a838bcaece65b873b3e938258483db14de4824b1595712e334a52d022032648d699669382591e3c94c4b0384e950f68b4b1f89d677ee75bc8a6be2b02401","52210365bb477e2a66a080abfc13126098db4bb71239312b92c050ed3b55a2e499f20721022a645cd88d0d53ccee59e9ce0c6a804ff6dddd0939707271f3137d367ec76a9d21020abcb94b276ed7c703f96caf5bba50d93d2121b711d785d945b43876ba2744c253ae"],"is_coinbase":false,"sequence":4294967295,"inner_witnessscript_asm":"OP_PUSHNUM_2 OP_PUSHBYTES_33 0365bb477e2a66a080abfc13126098db4bb71239312b92c050ed3b55a2e499f207 OP_PUSHBYTES_33 022a645cd88d0d53ccee59e9ce0c6a804ff6dddd0939707271f3137d367ec76a9d OP_PUSHBYTES_33 020abcb94b276ed7c703f96caf5bba50d93d2121b711d785d945b43876ba2744c2 OP_PUSHNUM_3 OP_CHECKMULTISIG"}],"vout":[{"scriptpubkey":"00145c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 5c3b09cb8f3a2fe0ac08f2b4f07248ec18bc9ac9","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3","value":2373},{"scriptpubkey":"0014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_asm":"OP_0 OP_PUSHBYTES_20 e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447","scriptpubkey_type":"v0_p2wpkh","scriptpubkey_address":"tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37","value":16}],"size":368,"weight":707,"sigops":3,"fee":750,"status":{"confirmed":true,"block_height":1477708,"block_hash":"000002573ab7f3b3ab9c0a3636075a5156723401a806969be5393123939f64a3","block_time":1727766144}}]"#;

        let transactions: Vec<Tx> = serde_json::from_str(transactions_json).unwrap();

        let mut total_deposited = 0i64;
        let mut total_spent = 0i64;

        for tx in transactions {
            let deposited = total_amount_deposited(&contract_script, &tx) as i64;
            let spent = total_amount_spent(&contract_script, &tx) as i64;
            total_deposited += deposited;
            total_spent += spent;
        }

        let net_balance = total_deposited.checked_sub(total_spent).unwrap();
        assert_eq!(total_deposited, 3897063);
        assert_eq!(total_spent, 3897063);
        assert_eq!(net_balance, 0);
    }
}
