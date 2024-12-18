use crate::db;
use crate::model::ContractVersion;
use anyhow::Context;
use anyhow::Result;
use bitcoin::absolute::LockTime;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32::ChildNumber;
use bitcoin::bip32::Xpriv;
use bitcoin::bip32::Xpub;
use bitcoin::key::Keypair;
use bitcoin::key::Secp256k1;
use bitcoin::psbt;
use bitcoin::psbt::Psbt;
use bitcoin::psbt::PsbtSighashType;
use bitcoin::sighash::SighashCache;
use bitcoin::transaction::Version;
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::EcdsaSighashType;
use bitcoin::Network;
use bitcoin::NetworkKind;
use bitcoin::OutPoint;
use bitcoin::PublicKey;
use bitcoin::ScriptBuf;
use bitcoin::Transaction;
use bitcoin::TxIn;
use bitcoin::TxOut;
use descriptor_wallet::DescriptorWallet;
use miniscript::Descriptor;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;

/// Everything below this value is counted as dust. Based on segwit and 1 input and 1 output
const MIN_TX_OUTPUT_VALUE: u64 = 294;

pub struct Wallet {
    hub_xpriv: Xpriv,
    /// We only have the fallback key as an [`Xpub`] because we only want to use the corresponding
    /// [`Xpriv`] _manually_ under extreme circumstances.
    ///
    /// This key was deprecated with the introduction of [`ContractVersion::TwoOfThree`]. We only
    /// keep it around for [`ContractVersion::TwoOfFour`].
    deprecated_fallback_xpub: Xpub,
    network: Network,
    hub_fee_wallet: DescriptorWallet,
    db: Pool<Postgres>,
}

impl Wallet {
    pub fn new(
        hub_seed: Vec<u8>,
        deprecated_fallback_xpub: &str,
        network: Network,
        hub_fee_wallet: DescriptorWallet,
        db: Pool<Postgres>,
    ) -> Result<Self> {
        let hub_xpriv = Xpriv::new_master(NetworkKind::from(network), &hub_seed)?;
        let fallback_xpub = Xpub::from_str(deprecated_fallback_xpub)?;

        Ok(Self {
            hub_xpriv,
            deprecated_fallback_xpub: fallback_xpub,
            network,
            hub_fee_wallet,
            db,
        })
    }

    /// Generate a collateral contract address for a borrower.
    pub async fn contract_address(
        &self,
        borrower_pk: PublicKey,
        lender_xpub: &Xpub,
        contract_version: ContractVersion,
    ) -> Result<(Address, u32)> {
        let (hub_pk, fallback_pk, index) = self.derive_next_pks().await?;

        // We use the same index for the lender so that it's easier to recover the correct lender
        // keypair.
        let lender_pk = derive_lender_pk(lender_xpub, index, self.hub_xpriv.network.is_mainnet())?;

        let descriptor = match contract_version {
            ContractVersion::TwoOfFour => two_of_four_collateral_contract_descriptor(
                borrower_pk,
                hub_pk,
                fallback_pk,
                lender_pk,
            )?,
            ContractVersion::TwoOfThree => {
                two_of_three_collateral_contract_descriptor(borrower_pk, hub_pk, lender_pk)?
            }
        };

        let address = descriptor.address(self.network)?;

        Ok((address, index))
    }

    /// Will create a PSBT to spend the whole output to 2 addresses:
    ///
    /// 1. The `borrower_address`.
    ///
    /// 2. A newly derived address from the `hub_fee_wallet`.
    #[allow(clippy::too_many_arguments)]
    pub fn create_dispute_claim_collateral_psbt(
        &mut self,
        borrower_pk: PublicKey,
        lender_xpub: &Xpub,
        contract_index: u32,
        collateral_outputs: Vec<(OutPoint, u64)>,
        borrower_address: Address<NetworkUnchecked>,
        borrower_amount_sats: u64,
        liquidator_amount_sats: u64,
        // In the DLC-based protocol, we will probably charge the origination fee when the
        // collateral is locked up.
        origination_fee: u64,
        fee_rate_spvb: u64,
        contract_version: ContractVersion,
    ) -> Result<(Psbt, Descriptor<PublicKey>)> {
        let (hub_kp, fallback_pk) = self.get_keys_for_index(contract_index)?;
        let hub_pk = PublicKey::new(hub_kp.public_key());

        let lender_pk = derive_lender_pk(
            lender_xpub,
            contract_index,
            self.hub_xpriv.network.is_mainnet(),
        )?;

        let liquidator_address_info = self.hub_fee_wallet.get_new_address()?;
        let liquidator_address =
            Address::from_str(liquidator_address_info.address.to_string().as_str())?;
        let target_outputs = [
            (borrower_address, borrower_amount_sats),
            (liquidator_address, liquidator_amount_sats),
        ];

        let mut inputs = Vec::new();
        for (outpoint, _) in collateral_outputs.iter() {
            let input = TxIn {
                previous_output: *outpoint,
                ..Default::default()
            };

            inputs.push(input)
        }

        // FIXME: Incorrect arbitrary value!
        let tx_weight_vb = 200 + (collateral_outputs.len() as u64) * 50;

        let tx_fee = tx_weight_vb * fee_rate_spvb;

        // Filter out small outputs
        // TODO: if an output was filtered out, we shouldn't burn it as tx fee,
        // instead credit it to the other party
        let outputs = target_outputs
            .into_iter()
            .filter(|(_, amount)| amount >= &MIN_TX_OUTPUT_VALUE)
            .collect::<Vec<_>>();

        let tx_fee_per_output = tx_fee / outputs.len() as u64;

        let mut outputs = outputs
            .into_iter()
            .filter_map(|(address, amount)| {
                if tx_fee_per_output > amount {
                    // Tx fee is too high, ignoring output
                    tracing::warn!(
                        address = address.assume_checked().to_string(),
                        amount,
                        tx_fee_per_output,
                        "Ignoring output as tx fee would render output too small"
                    );
                    None
                } else if amount - tx_fee_per_output < MIN_TX_OUTPUT_VALUE {
                    tracing::warn!(
                        address = address.assume_checked().to_string(),
                        amount,
                        tx_fee_per_output,
                        "Ignoring output as tx fee would render output too small"
                    );
                    None
                } else {
                    Some(TxOut {
                        value: Amount::from_sat(amount - tx_fee_per_output),
                        script_pubkey: address.assume_checked().script_pubkey(),
                    })
                }
            })
            .collect::<Vec<_>>();

        let new_address = self.hub_fee_wallet.get_new_address()?;
        let origination_fee_output = TxOut {
            value: Amount::from_sat(origination_fee),
            script_pubkey: ScriptBuf::from_bytes(new_address.address.script_pubkey().to_bytes()),
        };

        outputs.push(origination_fee_output);

        let unsigned_claim_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output: outputs,
        };

        // All collateral outputs share the same script.
        let collateral_descriptor = match contract_version {
            ContractVersion::TwoOfFour => two_of_four_collateral_contract_descriptor(
                borrower_pk,
                hub_pk,
                fallback_pk,
                lender_pk,
            )?,
            ContractVersion::TwoOfThree => {
                two_of_three_collateral_contract_descriptor(borrower_pk, hub_pk, lender_pk)?
            }
        };
        let witness_script = collateral_descriptor.script_code()?;

        let mut inputs = Vec::new();

        // The order is important.
        for (i, (_, amount_sats)) in collateral_outputs.iter().enumerate() {
            let witness_script = witness_script.clone();
            let amount_sats = Amount::from_sat(*amount_sats);

            let sighash = SighashCache::new(&unsigned_claim_tx).p2wsh_signature_hash(
                i,
                &witness_script,
                amount_sats,
                EcdsaSighashType::All,
            )?;

            let mut input = psbt::Input {
                witness_utxo: Some(TxOut {
                    value: amount_sats,
                    script_pubkey: collateral_descriptor.script_pubkey(),
                }),
                sighash_type: Some(PsbtSighashType::from_str("SIGHASH_ALL").expect("valid")),
                witness_script: Some(witness_script),
                ..Default::default()
            };

            let secp = Secp256k1::new();
            let hub_sk = hub_kp.secret_key();
            let sig = secp.sign_ecdsa(&sighash.into(), &hub_sk);

            input.partial_sigs.insert(
                hub_pk,
                bitcoin::ecdsa::Signature {
                    signature: sig,
                    sighash_type: EcdsaSighashType::All,
                },
            );

            inputs.push(input);
        }

        let mut claim_psbt = Psbt::from_unsigned_tx(unsigned_claim_tx)?;

        claim_psbt.inputs = inputs;

        Ok((claim_psbt, collateral_descriptor))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_claim_collateral_psbt(
        &mut self,
        borrower_pk: PublicKey,
        lender_xpub: &Xpub,
        contract_index: u32,
        collateral_outputs: Vec<(OutPoint, u64)>,
        // NOTE: In the DLC-based protocol, we will probably charge the origination fee when the
        // collateral is locked up.
        origination_fee: u64,
        borrower_btc_address: Address,
        fee_rate_spvb: u64,
        contract_version: ContractVersion,
    ) -> Result<(Psbt, Descriptor<PublicKey>)> {
        let (hub_kp, fallback_pk) = self.get_keys_for_index(contract_index)?;

        let lender_pk = derive_lender_pk(
            lender_xpub,
            contract_index,
            self.hub_xpriv.network.is_mainnet(),
        )?;

        let mut inputs = Vec::new();
        for (outpoint, _) in collateral_outputs.iter() {
            let input = TxIn {
                previous_output: *outpoint,
                ..Default::default()
            };

            inputs.push(input)
        }

        // FIXME: Incorrect arbitrary value!
        let tx_weight_vb = 200 + (collateral_outputs.len() as u64) * 50;

        let tx_fee = tx_weight_vb * fee_rate_spvb;

        let total_collateral_amount = collateral_outputs.iter().fold(0, |acc, (_, a)| acc + a);
        let claim_amount = total_collateral_amount
            .checked_sub(origination_fee + tx_fee)
            .context("Negative claim amount")?;

        let claim_output = TxOut {
            value: Amount::from_sat(claim_amount),
            script_pubkey: borrower_btc_address.script_pubkey(),
        };

        let new_address = self.hub_fee_wallet.get_new_address()?;

        let origination_fee_output = TxOut {
            value: Amount::from_sat(origination_fee),
            script_pubkey: ScriptBuf::from_bytes(new_address.address.script_pubkey().to_bytes()),
        };

        let output = if claim_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: origination_fee_output.value + claim_output.value,
                script_pubkey: origination_fee_output.script_pubkey,
            }]
        } else if origination_fee_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: claim_output.value + origination_fee_output.value,
                script_pubkey: claim_output.script_pubkey,
            }]
        } else {
            vec![claim_output, origination_fee_output]
        };

        let unsigned_claim_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output,
        };

        // All collateral outputs share the same script.
        let hub_pk = PublicKey::new(hub_kp.public_key());
        let collateral_descriptor = match contract_version {
            ContractVersion::TwoOfFour => two_of_four_collateral_contract_descriptor(
                borrower_pk,
                hub_pk,
                fallback_pk,
                lender_pk,
            )?,
            ContractVersion::TwoOfThree => {
                two_of_three_collateral_contract_descriptor(borrower_pk, hub_pk, lender_pk)?
            }
        };
        let witness_script = collateral_descriptor.script_code()?;

        let mut inputs = Vec::new();

        // The order is important.
        for (i, (_, amount_sats)) in collateral_outputs.iter().enumerate() {
            let witness_script = witness_script.clone();
            let amount_sats = Amount::from_sat(*amount_sats);

            let sighash = SighashCache::new(&unsigned_claim_tx).p2wsh_signature_hash(
                i,
                &witness_script,
                amount_sats,
                EcdsaSighashType::All,
            )?;

            let mut input = psbt::Input {
                witness_utxo: Some(TxOut {
                    value: amount_sats,
                    script_pubkey: collateral_descriptor.script_pubkey(),
                }),
                sighash_type: Some(PsbtSighashType::from_str("SIGHASH_ALL").expect("valid")),
                witness_script: Some(witness_script),
                ..Default::default()
            };

            let secp = Secp256k1::new();
            let hub_sk = hub_kp.secret_key();
            let sig = secp.sign_ecdsa(&sighash.into(), &hub_sk);

            input.partial_sigs.insert(
                hub_pk,
                bitcoin::ecdsa::Signature {
                    signature: sig,
                    sighash_type: EcdsaSighashType::All,
                },
            );

            inputs.push(input);
        }

        let mut claim_psbt = Psbt::from_unsigned_tx(unsigned_claim_tx)?;

        claim_psbt.inputs = inputs;

        Ok((claim_psbt, collateral_descriptor))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_liquidation_psbt(
        &mut self,
        borrower_pk: PublicKey,
        lender_xpub: &Xpub,
        contract_index: u32,
        collateral_outputs: Vec<(OutPoint, u64)>,
        origination_fee: Amount,
        lender_amount: Amount,
        lender_address: Address,
        borrower_btc_address: Address,
        fee_rate_spvb: u64,
        contract_version: ContractVersion,
    ) -> Result<(Psbt, Descriptor<PublicKey>, PublicKey)> {
        let (hub_kp, fallback_pk) = self.get_keys_for_index(contract_index)?;

        let lender_pk = derive_lender_pk(
            lender_xpub,
            contract_index,
            self.hub_xpriv.network.is_mainnet(),
        )?;

        let mut inputs = Vec::new();
        for (outpoint, _) in collateral_outputs.iter() {
            let input = TxIn {
                previous_output: *outpoint,
                ..Default::default()
            };

            inputs.push(input)
        }

        // FIXME: Incorrect arbitrary value!
        let tx_weight_vb = 200 + (collateral_outputs.len() as u64) * 50;

        let tx_fee = Amount::from_sat(tx_weight_vb * fee_rate_spvb);

        let total_collateral_amount =
            Amount::from_sat(collateral_outputs.iter().fold(0, |acc, (_, a)| acc + a));
        let borrower_amount = total_collateral_amount
            .checked_sub(origination_fee + lender_amount + tx_fee)
            .with_context(|| {
                format!(
                    "Collateral ({total_collateral_amount}) cannot cover lender amount \
                     ({lender_amount}) origination_fee ({origination_fee}) and TX fee {tx_fee}"
                )
            })?;

        let borrower_output = TxOut {
            value: borrower_amount,
            script_pubkey: borrower_btc_address.script_pubkey(),
        };

        let lender_output = TxOut {
            value: lender_amount,
            script_pubkey: lender_address.script_pubkey(),
        };

        let origination_fee_output = {
            let address = self.hub_fee_wallet.get_new_address()?;

            TxOut {
                value: origination_fee,
                script_pubkey: ScriptBuf::from_bytes(address.address.script_pubkey().to_bytes()),
            }
        };

        let output = vec![borrower_output, lender_output, origination_fee_output];

        // Any output that would be below `MIN_TX_OUTPUT_VALUE` goes towards the transaction fee
        // instead.
        let output = output
            .into_iter()
            .filter(|o| o.value.to_sat() >= MIN_TX_OUTPUT_VALUE)
            .collect::<Vec<_>>();

        let unsigned_claim_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output,
        };

        // All collateral outputs share the same script.
        let hub_pk = PublicKey::new(hub_kp.public_key());
        let collateral_descriptor = match contract_version {
            ContractVersion::TwoOfFour => two_of_four_collateral_contract_descriptor(
                borrower_pk,
                hub_pk,
                fallback_pk,
                lender_pk,
            )?,
            ContractVersion::TwoOfThree => {
                two_of_three_collateral_contract_descriptor(borrower_pk, hub_pk, lender_pk)?
            }
        };
        let witness_script = collateral_descriptor.script_code()?;

        let mut inputs = Vec::new();

        // The order is important.
        for (i, (_, amount_sats)) in collateral_outputs.iter().enumerate() {
            let witness_script = witness_script.clone();
            let amount_sats = Amount::from_sat(*amount_sats);

            let sighash = SighashCache::new(&unsigned_claim_tx).p2wsh_signature_hash(
                i,
                &witness_script,
                amount_sats,
                EcdsaSighashType::All,
            )?;

            let mut input = psbt::Input {
                witness_utxo: Some(TxOut {
                    value: amount_sats,
                    script_pubkey: collateral_descriptor.script_pubkey(),
                }),
                sighash_type: Some(PsbtSighashType::from_str("SIGHASH_ALL").expect("valid")),
                witness_script: Some(witness_script),
                ..Default::default()
            };

            let secp = Secp256k1::new();
            let hub_sk = hub_kp.secret_key();
            let sig = secp.sign_ecdsa(&sighash.into(), &hub_sk);

            input.partial_sigs.insert(
                hub_pk,
                bitcoin::ecdsa::Signature {
                    signature: sig,
                    sighash_type: EcdsaSighashType::All,
                },
            );

            inputs.push(input);
        }

        let mut psbt = Psbt::from_unsigned_tx(unsigned_claim_tx)?;

        psbt.inputs = inputs;

        Ok((psbt, collateral_descriptor, lender_pk))
    }

    fn get_keys_for_index(&self, index: u32) -> Result<(Keypair, PublicKey)> {
        let secp = Secp256k1::new();

        let (network_harderned_index, network_normal_index) = if self.hub_xpriv.network.is_mainnet()
        {
            (
                ChildNumber::from_hardened_idx(0).expect("infallible"),
                ChildNumber::from_normal_idx(0).expect("infallible"),
            )
        } else {
            (
                ChildNumber::from_hardened_idx(1).expect("infallible"),
                ChildNumber::from_normal_idx(1).expect("infallible"),
            )
        };

        let hub_kp = {
            let path = [
                ChildNumber::from_hardened_idx(586).expect("infallible"),
                network_harderned_index,
                ChildNumber::from_hardened_idx(index).expect("infallible"),
            ];

            let child_xpriv = self.hub_xpriv.derive_priv(&secp, &path)?;

            child_xpriv.to_keypair(&secp)
        };

        let fallback_pk = {
            let path = [
                ChildNumber::from_normal_idx(586).expect("infallible"),
                network_normal_index,
                ChildNumber::from_normal_idx(index).expect("infallible"),
            ];

            let child_xpub = self.deprecated_fallback_xpub.derive_pub(&secp, &path)?;
            PublicKey::new(child_xpub.public_key)
        };

        Ok((hub_kp, fallback_pk))
    }

    /// Derive the next set of hub PKs for a collateral contract.
    ///
    /// The keys are derived deterministically.
    ///
    /// # Returns
    ///
    /// - The hub PK to be used in the collateral contract.
    /// - The fallback PK to be used in the collateral contract.
    /// - The index used to derive the two keys.
    async fn derive_next_pks(&self) -> Result<(PublicKey, PublicKey, u32)> {
        let index = db::wallet_index::get_max_and_increment(&self.db).await?;
        let index = index as u32;

        let (hub_kp, fallback_pk) = self.get_keys_for_index(index)?;

        let hub_pk = PublicKey::new(hub_kp.public_key());

        Ok((hub_pk, fallback_pk, index))
    }

    pub fn network(&self) -> Network {
        self.network
    }
}

fn two_of_four_collateral_contract_descriptor(
    borrower_pk: PublicKey,
    hub_pk: PublicKey,
    fallback_pk: PublicKey,
    lender_pk: PublicKey,
) -> Result<Descriptor<PublicKey>, miniscript::Error> {
    format!("wsh(multi(2,{borrower_pk},{hub_pk},{fallback_pk},{lender_pk}))").parse()
}

fn two_of_three_collateral_contract_descriptor(
    borrower_pk: PublicKey,
    hub_pk: PublicKey,
    lender_pk: PublicKey,
) -> Result<Descriptor<PublicKey>, miniscript::Error> {
    format!("wsh(multi(2,{borrower_pk},{hub_pk},{lender_pk}))").parse()
}

fn derive_lender_pk(lender_xpub: &Xpub, index: u32, is_mainnet: bool) -> Result<PublicKey> {
    let secp = Secp256k1::new();

    let network_index = if is_mainnet {
        ChildNumber::from_normal_idx(0).expect("infallible")
    } else {
        ChildNumber::from_normal_idx(1).expect("infallible")
    };

    let pk = {
        let path = [
            ChildNumber::from_normal_idx(586).expect("infallible"),
            network_index,
            ChildNumber::from_normal_idx(index).expect("infallible"),
        ];

        let child_xpub = lender_xpub.derive_pub(&secp, &path)?;
        PublicKey::new(child_xpub.public_key)
    };

    Ok(pk)
}
