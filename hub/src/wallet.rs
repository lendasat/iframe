use crate::db;
use crate::model::ContractVersion;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bitcoin::absolute::LockTime;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32::ChildNumber;
use bitcoin::bip32::DerivationPath;
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
use bitcoin::Witness;
use bitcoin_units::FeeRate;
use descriptor_wallet::DescriptorWallet;
use hex::FromHex;
use miniscript::Descriptor;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;
use std::sync::Mutex;

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
    hub_fee_wallet: Mutex<DescriptorWallet>,
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
            hub_fee_wallet: Mutex::new(hub_fee_wallet),
            db,
        })
    }

    pub fn network(&self) -> Network {
        self.network
    }

    /// Generate a collateral contract address for a borrower, using a [`PublicKey`] provided by the
    /// borrower.
    pub async fn contract_address(
        &self,
        borrower_xpub: &Xpub,
        lender_xpub: &Xpub,
        contract_version: ContractVersion,
    ) -> Result<(Address, u32)> {
        let (hub_pk, _, index) = self.derive_next_pks().await?;

        // We use the same index for borrower and lender so that it's easier to recover the correct
        // borrower/lender keypair.
        let (lender_pk, _) =
            derive_borrower_or_lender_pk(lender_xpub, index, self.hub_xpriv.network.is_mainnet())?;
        let (borrower_pk, _) = derive_borrower_or_lender_pk(
            borrower_xpub,
            index,
            self.hub_xpriv.network.is_mainnet(),
        )?;

        let descriptor = match contract_version {
            ContractVersion::TwoOfFour => {
                bail!("Two-of-four multisig contract not supported with borrower Xpub")
            }
            ContractVersion::TwoOfThree => {
                two_of_three_collateral_contract_descriptor(borrower_pk, hub_pk, lender_pk)?
            }
        };

        let address = descriptor.address(self.network)?;

        Ok((address, index))
    }

    /// Generate a collateral contract address for a borrower, using a [`PublicKey`] provided by the
    /// borrower.
    ///
    /// This is a legacy function. New contracts should use `contract_address`.
    pub async fn contract_address_with_borrower_pk(
        &self,
        borrower_pk: PublicKey,
        lender_xpub: &Xpub,
        contract_version: ContractVersion,
    ) -> Result<(Address, u32)> {
        let (hub_pk, fallback_pk, index) = self.derive_next_pks().await?;

        // We use the same index for the lender so that it's easier to recover the correct lender
        // keypair.
        let (lender_pk, _) =
            derive_borrower_or_lender_pk(lender_xpub, index, self.hub_xpriv.network.is_mainnet())?;

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

    // TODO: Refactor this. We don't need this to be some kind of god function.
    #[allow(clippy::type_complexity)]
    pub fn collateral_descriptor(
        &self,
        borrower_xpub: &Xpub,
        borrower_pk: Option<PublicKey>,
        lender_xpub: &Xpub,
        contract_version: ContractVersion,
        contract_index: u32,
    ) -> Result<(
        Descriptor<PublicKey>,
        (PublicKey, Option<DerivationPath>),
        (PublicKey, DerivationPath),
    )> {
        let (hub_kp, fallback_pk) = self.get_keys_for_index(contract_index)?;
        let hub_pk = PublicKey::new(hub_kp.public_key());

        let is_mainnet = self.hub_xpriv.network.is_mainnet();
        let (lender_pk, lender_derivation) =
            derive_borrower_or_lender_pk(lender_xpub, contract_index, is_mainnet)?;

        let (borrower_pk, borrower_derivation) = match borrower_pk {
            // If we only have a `borrower_xpub`, use it to derive the descriptor.
            None => {
                let (borrower_pk, borrower_derivation) =
                    derive_borrower_or_lender_pk(borrower_xpub, contract_index, is_mainnet)?;

                (borrower_pk, Some(borrower_derivation))
            }
            // If the `borrower_pk` was ever set, we should use that one because we are dealing with
            // a legacy contract.
            Some(borrower_pk) => (borrower_pk, None),
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

        Ok((
            collateral_descriptor,
            (borrower_pk, borrower_derivation),
            (lender_pk, lender_derivation),
        ))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_claim_collateral_psbt(
        &self,
        borrower_xpub: &Xpub,
        borrower_pk: Option<PublicKey>,
        lender_xpub: &Xpub,
        contract_index: u32,
        collateral_outputs: Vec<(OutPoint, u64)>,
        // NOTE: In the DLC-based protocol, we will probably charge the origination fee when the
        // collateral is locked up.
        origination_fee: Amount,
        borrower_address: Address,
        fee_rate_spvb: u64,
        contract_version: ContractVersion,
    ) -> Result<(Psbt, Descriptor<PublicKey>, PublicKey)> {
        let (hub_kp, _) = self.get_keys_for_index(contract_index)?;

        let (collateral_descriptor, (borrower_pk, _), _) = self.collateral_descriptor(
            borrower_xpub,
            borrower_pk,
            lender_xpub,
            contract_version,
            contract_index,
        )?;

        let inputs = collateral_outputs
            .iter()
            .map(|(outpoint, _)| TxIn {
                previous_output: *outpoint,
                ..Default::default()
            })
            .collect::<Vec<_>>();

        let total_collateral_amount =
            Amount::from_sat(collateral_outputs.iter().fold(0, |acc, (_, a)| acc + a));
        let borrower_amount = total_collateral_amount
            .checked_sub(origination_fee)
            .context("Negative claim amount")?;

        let borrower_output = TxOut {
            value: borrower_amount,
            script_pubkey: borrower_address.script_pubkey(),
        };

        let origination_fee_address = self
            .hub_fee_wallet
            .lock()
            .expect("to get lock")
            .get_new_address()?;

        let origination_fee_output = TxOut {
            value: origination_fee,
            script_pubkey: ScriptBuf::from_bytes(
                origination_fee_address.address.script_pubkey().to_bytes(),
            ),
        };

        let outputs = if borrower_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: origination_fee_output.value + borrower_output.value,
                script_pubkey: origination_fee_output.script_pubkey,
            }]
        } else if origination_fee_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: borrower_output.value + origination_fee_output.value,
                script_pubkey: borrower_output.script_pubkey,
            }]
        } else {
            vec![borrower_output, origination_fee_output]
        };

        let mut unsigned_claim_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output: outputs,
        };

        // TODO: We need to check if the output holds enough to cover the fee.
        update_fee(
            fee_rate_spvb,
            total_collateral_amount.to_sat(),
            &mut unsigned_claim_tx,
            contract_version,
        );

        let mut psbt = Psbt::from_unsigned_tx(unsigned_claim_tx)?;
        sign_spend_tx(
            &mut psbt,
            hub_kp,
            collateral_outputs,
            &collateral_descriptor,
        )?;

        Ok((psbt, collateral_descriptor, borrower_pk))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_liquidation_psbt(
        &self,
        borrower_xpub: &Xpub,
        borrower_pk: Option<PublicKey>,
        lender_xpub: &Xpub,
        contract_index: u32,
        collateral_outputs: Vec<(OutPoint, u64)>,
        origination_fee: Amount,
        lender_amount: Amount,
        lender_address: Address,
        borrower_address: Address,
        fee_rate_spvb: u64,
        contract_version: ContractVersion,
    ) -> Result<(Psbt, Descriptor<PublicKey>, PublicKey)> {
        let (hub_kp, _) = self.get_keys_for_index(contract_index)?;

        let (collateral_descriptor, _, (lender_pk, _)) = self.collateral_descriptor(
            borrower_xpub,
            borrower_pk,
            lender_xpub,
            contract_version,
            contract_index,
        )?;

        let inputs = collateral_outputs
            .iter()
            .map(|(outpoint, _)| TxIn {
                previous_output: *outpoint,
                ..Default::default()
            })
            .collect::<Vec<_>>();

        let total_collateral_amount =
            Amount::from_sat(collateral_outputs.iter().fold(0, |acc, (_, a)| acc + a));
        let borrower_amount = total_collateral_amount
            .checked_sub(origination_fee + lender_amount)
            .with_context(|| {
                format!(
                    "Collateral ({total_collateral_amount}) cannot cover lender amount \
                     ({lender_amount}) origination_fee ({origination_fee})"
                )
            })?;

        let borrower_output = TxOut {
            value: borrower_amount,
            script_pubkey: borrower_address.script_pubkey(),
        };

        let lender_output = TxOut {
            value: lender_amount,
            script_pubkey: lender_address.script_pubkey(),
        };

        let mut outputs = if borrower_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: lender_output.value + borrower_output.value,
                script_pubkey: lender_output.script_pubkey,
            }]
        } else if lender_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: borrower_output.value + lender_output.value,
                script_pubkey: borrower_output.script_pubkey,
            }]
        } else {
            vec![borrower_output, lender_output]
        };

        if origination_fee.to_sat() < MIN_TX_OUTPUT_VALUE {
            outputs[0].value += origination_fee;
        } else {
            let origination_fee_output = {
                let address = self
                    .hub_fee_wallet
                    .lock()
                    .expect("to get lock")
                    .get_new_address()?;

                TxOut {
                    value: origination_fee,
                    script_pubkey: ScriptBuf::from_bytes(
                        address.address.script_pubkey().to_bytes(),
                    ),
                }
            };

            outputs.push(origination_fee_output);
        };

        let mut unsigned_claim_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output: outputs,
        };

        // TODO: We need to check if the output holds enough to cover the fee.
        update_fee(
            fee_rate_spvb,
            total_collateral_amount.to_sat(),
            &mut unsigned_claim_tx,
            contract_version,
        );

        let mut psbt = Psbt::from_unsigned_tx(unsigned_claim_tx)?;
        sign_spend_tx(
            &mut psbt,
            hub_kp,
            collateral_outputs,
            &collateral_descriptor,
        )?;

        Ok((psbt, collateral_descriptor, lender_pk))
    }

    /// Will create a PSBT to spend the whole output to 3 addresses:
    ///
    /// 1. The `borrower_address`.
    ///
    /// 2. The `liquidator_address`.
    ///
    /// 3. A newly derived address from the `hub_fee_wallet`.
    #[allow(clippy::too_many_arguments)]
    pub fn create_dispute_claim_collateral_psbt(
        &self,
        borrower_xpub: &Xpub,
        borrower_pk: Option<PublicKey>,
        lender_xpub: &Xpub,
        contract_index: u32,
        collateral_outputs: Vec<(OutPoint, u64)>,
        borrower_address: Address<NetworkUnchecked>,
        borrower_amount: Amount,
        liquidator_amount: Amount,
        // In the DLC-based protocol, we will probably charge the origination fee when the
        // collateral is locked up.
        origination_fee: Amount,
        fee_rate_spvb: u64,
        contract_version: ContractVersion,
    ) -> Result<(Psbt, Descriptor<PublicKey>, PublicKey)> {
        let (hub_kp, _) = self.get_keys_for_index(contract_index)?;

        let (collateral_descriptor, (borrower_pk, _), _) = self.collateral_descriptor(
            borrower_xpub,
            borrower_pk,
            lender_xpub,
            contract_version,
            contract_index,
        )?;

        let inputs = collateral_outputs
            .iter()
            .map(|(outpoint, _)| TxIn {
                previous_output: *outpoint,
                ..Default::default()
            })
            .collect::<Vec<_>>();

        let borrower_address = borrower_address.require_network(self.network)?;

        let borrower_output = TxOut {
            value: borrower_amount,
            script_pubkey: borrower_address.script_pubkey(),
        };

        let liquidator_address = self.get_liquidator_address()?;

        let liquidator_output = TxOut {
            value: liquidator_amount,
            script_pubkey: ScriptBuf::from_bytes(liquidator_address.script_pubkey().to_bytes()),
        };

        let mut outputs = if borrower_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: liquidator_output.value + borrower_output.value,
                script_pubkey: liquidator_output.script_pubkey,
            }]
        } else if liquidator_output.value.to_sat() < MIN_TX_OUTPUT_VALUE {
            vec![TxOut {
                value: borrower_output.value + liquidator_output.value,
                script_pubkey: borrower_output.script_pubkey,
            }]
        } else {
            vec![borrower_output, liquidator_output]
        };

        if origination_fee.to_sat() < MIN_TX_OUTPUT_VALUE {
            outputs[0].value += origination_fee;
        } else {
            let origination_fee_address = self
                .hub_fee_wallet
                .lock()
                .expect("to get lock")
                .get_new_address()?;
            let origination_fee_output = TxOut {
                value: origination_fee,
                script_pubkey: ScriptBuf::from_bytes(
                    origination_fee_address.address.script_pubkey().to_bytes(),
                ),
            };

            outputs.push(origination_fee_output);
        }

        let mut unsigned_claim_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output: outputs,
        };

        let total_collateral_amount = collateral_outputs.iter().fold(0, |acc, (_, a)| acc + a);

        // TODO: We need to check if the output holds enough to cover the fee.
        update_fee(
            fee_rate_spvb,
            total_collateral_amount,
            &mut unsigned_claim_tx,
            contract_version,
        );

        let mut psbt = Psbt::from_unsigned_tx(unsigned_claim_tx)?;
        sign_spend_tx(
            &mut psbt,
            hub_kp,
            collateral_outputs,
            &collateral_descriptor,
        )?;

        Ok((psbt, collateral_descriptor, borrower_pk))
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

    fn get_liquidator_address(&self) -> Result<Address> {
        let address_info = self
            .hub_fee_wallet
            .lock()
            .expect("to get lock")
            .get_new_address()?;

        // HACK: We convert like this because we are using two different versions of `rust-bitcoin`.
        let address = Address::from_str(address_info.address.to_string().as_str())?;

        let address = address.require_network(self.network)?;

        Ok(address)
    }
}

fn sign_spend_tx(
    spend_psbt: &mut Psbt,
    hub_kp: Keypair,
    collateral_outputs: Vec<(OutPoint, u64)>,
    collateral_descriptor: &Descriptor<PublicKey>,
) -> Result<()> {
    let spend_tx = &spend_psbt.unsigned_tx;

    let hub_pk = PublicKey::new(hub_kp.public_key());

    let script_pubkey = collateral_descriptor.script_pubkey();
    let witness_script = collateral_descriptor.script_code()?;

    let mut inputs = Vec::new();
    for (i, (_, amount_sats)) in collateral_outputs.iter().enumerate() {
        let amount_sats = Amount::from_sat(*amount_sats);

        let sighash = SighashCache::new(spend_tx).p2wsh_signature_hash(
            i,
            &witness_script,
            amount_sats,
            EcdsaSighashType::All,
        )?;

        let mut input = psbt::Input {
            witness_utxo: Some(TxOut {
                value: amount_sats,
                script_pubkey: script_pubkey.clone(),
            }),
            sighash_type: Some(PsbtSighashType::from_str("SIGHASH_ALL").expect("valid")),
            witness_script: Some(witness_script.clone()),
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

    spend_psbt.inputs = inputs;

    Ok(())
}

fn calculate_fee_rate(tx: Transaction, total_input_amount: Amount) -> FeeRate {
    let fee_amount = calculate_fee_amount(&tx, total_input_amount);
    fee_amount / tx.weight()
}

fn calculate_fee_amount(tx: &Transaction, total_input_amount: Amount) -> Amount {
    let total_output_amount = tx.output.iter().map(|o| o.value).sum();
    total_input_amount - total_output_amount
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

pub fn derive_borrower_or_lender_pk(
    lender_xpub: &Xpub,
    index: u32,
    is_mainnet: bool,
) -> Result<(PublicKey, DerivationPath)> {
    let secp = Secp256k1::new();

    let network_index = if is_mainnet {
        ChildNumber::from_normal_idx(0).expect("infallible")
    } else {
        ChildNumber::from_normal_idx(1).expect("infallible")
    };

    let path = vec![
        ChildNumber::from_normal_idx(586).expect("infallible"),
        network_index,
        ChildNumber::from_normal_idx(index).expect("infallible"),
    ];

    let pk = {
        let child_xpub = lender_xpub.derive_pub(&secp, &path)?;
        PublicKey::new(child_xpub.public_key)
    };

    let derivation_path = DerivationPath::from(path);

    Ok((pk, derivation_path))
}

/// Updates how much fee the transaction pays by reducing the amount sent to [`output`]
fn update_fee(
    fee_rate_spvb: u64,
    total_collateral_amount: u64,
    unsigned_claim_tx: &mut Transaction,
    contract_version: ContractVersion,
) {
    // We assume that the refund output is always the first output.
    const COLLATERAL_OUTPUT_INDEX: usize = 0;

    if contract_version != ContractVersion::TwoOfThree {
        tracing::warn!(?contract_version, "Fee calculation will be inaccurate");
    }

    let mut sample_signed_tx = unsigned_claim_tx.clone();

    // sample witness stack taken from a simple 2of3 multi-sig
    let witness = [
        Vec::from_hex("").expect("to be a vec"),
        Vec::from_hex("30440220539a32ea34d8bb124255bc9e1c58b281727e9b98e87a140015459c6e74c92dea022021d397de1d67802c83872862498664e22f557c3a896ee1763fe66f08d07495e101").expect("to be a vec"),
        Vec::from_hex("3044022060b0b382040373640cb2cb488dabec25bab817c8a574be5cef07284647d4bc9a02207c4d94350be6449c40b6e5c1d29b01c441807b0b4a3c6e3cd48b1f8916e9b14801").expect("to be a vec"),
        Vec::from_hex("52210341e69dcf830490e3f37c72a04c1f7fda50364524ff9a7f9bee356af7e93a88c52102e7d424c60e484cca1b5c1a1bd37c52b13130424afd5c935e345ca76ca9565d33210275fa3cbc739a93d5d3a55c05e2295d30a690d847927a8cc1b1eb0937ac13c38353ae").expect("to be a vec"),
    ];

    sample_signed_tx
        .input
        .iter_mut()
        .for_each(|input| input.witness = Witness::from_slice(&witness));

    // We calculate the fee rate, and reduce the output until we get to the wanted sats per vByte,
    // this will lead to a slight overshooting which is unavoidable unless we change
    // `ADJUSTMENT_AMOUNT` to 1 sat, but then we would have 100x more iterations.
    const ADJUSTMENT_AMOUNT: u64 = 100;
    {
        let mut calculated_fee = calculate_fee_rate(
            sample_signed_tx.clone(),
            Amount::from_sat(total_collateral_amount),
        );

        while calculated_fee.to_sat_per_vb_ceil() <= fee_rate_spvb {
            tracing::debug!(
                calculated_fee = calculated_fee.to_sat_per_vb_ceil(),
                wanted_fee = fee_rate_spvb,
                "Fee rate not met, reducing"
            );

            if sample_signed_tx.output[COLLATERAL_OUTPUT_INDEX]
                .value
                .to_sat()
                < ADJUSTMENT_AMOUNT
                || sample_signed_tx.output[COLLATERAL_OUTPUT_INDEX]
                    .value
                    .to_sat()
                    - ADJUSTMENT_AMOUNT
                    < MIN_TX_OUTPUT_VALUE
            {
                // can't cover tx fee, we drop this output
                sample_signed_tx.output.remove(COLLATERAL_OUTPUT_INDEX);
                // we need to remove the output from the original tx as well
                unsigned_claim_tx.output.remove(COLLATERAL_OUTPUT_INDEX);
                tracing::warn!("Output couldn't cover fee, hence we drop the output and continue with the next output");
            }
            sample_signed_tx.output[COLLATERAL_OUTPUT_INDEX].value -=
                Amount::from_sat(ADJUSTMENT_AMOUNT);
            calculated_fee = calculate_fee_rate(
                sample_signed_tx.clone(),
                Amount::from_sat(total_collateral_amount),
            );
        }
    }

    // update the output amount of the provided transaction
    unsigned_claim_tx.output[COLLATERAL_OUTPUT_INDEX].value =
        sample_signed_tx.output[COLLATERAL_OUTPUT_INDEX].value;
}

#[cfg(test)]
mod tests {
    use super::*;
    use bitcoin::consensus::encode::deserialize;
    use bitcoin::Amount;
    use bitcoin::FeeRate;
    use bitcoin::Transaction;
    use bitcoin::Txid;

    #[test]
    fn test_calculate_fee_rate() {
        // Example transaction taken from: https://mempool.space/tx/8ed825f3414ad1e14017bd0895397583efbc071a97d48e32c9405c6783d6a329
        let tx_hex = "0200000000010185d40e8b1752377b082cd9521f57ef6b2f8e64e77a048f002e29c317510c9dcf1100000000fdffffff0fa4743100000000001600148e91eeeba56eef1bc9537b0b2967b0898934ec5ab173120000000000160014e5d4a97318440421d2273b6de37044f6c3d028b7c64a46000000000016001498eaab114122c0e313410715bc70ff94a318c8e92a8d6100000000002251209cad789fc1466bbca60672d11fff041c010ce88f7acd98f765f6604500631bdf668a070000000000160014b3c347edbc430bc361dc49aea09f24c5637e37ec7a960000000000001976a914d8b123ffb132a5f76d06c931b6c136127204952988acbe7c07000000000016001468e7b8927ebddd98dac907bb9c67fc1328d2ee7d9b5427000000000016001412ad6107eebda44c4f6154f35b0a9ed5c487ffa8f289050000000000160014cb67db77d0a0002470c813962ef1e54086a49a323b76f40500000000160014979c7bc678e031bdfc907559632278904d8aaab22dbd1300000000001600147a9415eb6545f1b3f9a5729713623dbab1dd40228df006000000000017a914d662ebf23e5318e2b7c9fbdca77731f107f8a0468708410a0000000000160014c92942f6b18568fe37f9fca95ab46bb11a5b569e5f3d050000000000220020a227155d5896fbf58f9e4fd51e9c2b9160b175c2da7d07f0d1748207e8d01541a394e30f000000001600143877cc298fc5b8a591e34982a91183bb35f0c2420247304402207e1afd03357595269b2a71a6f49eb0526ae32467aecfdc1140605a97297aaf3d0220319bbde2217bf101de5c82247e6021d1383c2caaa5895e16ad9711fb7adc92d30121023e86a944b9cff6bea3e61d3594820cacbfb122b817934f981256b2bc4e6b850400000000";

        let tx: Transaction = deserialize(&hex::decode(tx_hex).unwrap()).unwrap();

        // Taken from mempool.space
        let total_input_amount = Amount::from_sat(388_659_747);

        let expected_fee_rate = FeeRate::from_sat_per_vb_unchecked(3);

        let actual_fee_rate = calculate_fee_rate(tx, total_input_amount);

        assert_eq!(
            actual_fee_rate.to_sat_per_vb_ceil(),
            expected_fee_rate.to_sat_per_vb_ceil()
        );
    }

    #[test]
    fn test_calculate_fee_rate_2_inputs() {
        // Collateral funding transaction with 2 inputs and 2 outputs (refund and origination fee)
        // Example transaction taken from: https://mutinynet.com/api/tx/93a74403f11c8aff71ff4497c351cbcffc18a376cfc1738b088ba162c12ae319/hex
        let tx_hex = "02000000000102dcc95a2f1059a6b54b1074cb38c2610a48f0e12a715d44bbcf91420ad3847fe00000000000ffffffffb7bb469e60f757390434792e4996a28008164cc892abc7856f0b377e3c1f457b0100000000ffffffff0286a2030000000000160014cbab657cdd6e9e32e40b5b3ba3c5068d85e7287a1f07000000000000160014e3bd4bbdcad0f036a7a3d5a6cb27a20b88205447040047304402204ef6eae9e18bb13abffaa12016338ad00643c4cb8120d4f42e3e488fb50ef20b02202b029d1cfdc51b0466e954ca2aff1fcce14f53096b1e2547499ce085414ba9fc01483045022100848c7d4d0f37e5e1b3751388ed6a216092419190b796b1d72a9b1546e49fbe9702205e0f079b80cb2412744ca172329d382a95113142ab90dfa16933ca74d565f6f50169522102d346ee590a95992b184433526f94ff23843f546853ef9dce406af4e7852bdfb2210206b0c487a6e223a667a54db318da2373dea6e139bbc2c6494cda0ca2b8a94bfb2103c5daed8afc5ed1486819789555e03446e135361d06b8712f85e2496994b57e8d53ae04004730440220075e3038bd85ae6bd05124d67d14db53dff78d29cde2bb5a9c4fdfa9e11f812e0220032be2c3efff88370cdf051a5b7736c8f31a37132f025003336af9c4f877b86a01483045022100cbc44b1153b1ad6fac7272d6185aade4c9c66bb8183bca40c89d545a02fb3fb102200e1b25bd96f930c6abb283554ab8818c6a10939f017074c44f0dfa303a19d9010169522102d346ee590a95992b184433526f94ff23843f546853ef9dce406af4e7852bdfb2210206b0c487a6e223a667a54db318da2373dea6e139bbc2c6494cda0ca2b8a94bfb2103c5daed8afc5ed1486819789555e03446e135361d06b8712f85e2496994b57e8d53ae00000000";

        let tx: Transaction = deserialize(&hex::decode(tx_hex).unwrap()).unwrap();

        // Taken from mempool.space https://mutinynet.com/address/tb1qvcq8h554lkdvlr60kz23eyfxnd5mlzf6q2j53rtz906a3yvt77tsk6mcwm
        let total_input_amount = Amount::from_sat(245_937);

        let expected_fee_rate = FeeRate::from_sat_per_vb_unchecked(21);

        let actual_fee_rate = calculate_fee_rate(tx, total_input_amount);

        assert_eq!(
            actual_fee_rate.to_sat_per_vb_ceil(),
            expected_fee_rate.to_sat_per_vb_ceil()
        );
    }

    #[test]
    fn test_estimate_fee_rate_and_compare() {
        // Collateral funding transaction with 1 input and 2 outputs (refund and origination fee)
        // Example transaction taken from: https://mutinynet.com/api/tx/c3ef7eb2a6c341ec2deb72a68bbdec249d20bb37c16d7bd4b9489e8539895440/hex
        let tx_hex = "020000000001011ff103086c0576460a82028463b592ec4527dbb368292c8d4a1c65850da392200000000000ffffffff0251af0300000000001600144c79b50158c70a1838a2feb54250a8bcc5de1b992407000000000000160014e3bd4bbdcad0f036a7a3d5a6cb27a20b8820544704004830450221008bbea01873507fff28ebad70ccfe906662788848eae655430a493cd3a9c511bc0220526a49fdef5e072a8a97f632b948820961a11220d437779c5a7befb3f18b79ee0147304402203aa9d7f74c68b7006b89d95b5bdde66d7aafa9cef8ffec732926679b07be47340220543fe4b199550fbbbf55469c2770c7558c4ac88b4b91fa736b31a6089276ec49016952210347e3c2d5408487258410767b321b843958c112c6ae0de20007a8a0a7a7b2acb521028612fa09c36fdeb18a498bbdf714d2699fc353e7711a01989969c6c42111acf821038946c3f6702dbff2fe9e0556908d390cbd829510d52d4a664093224ec127a54353ae00000000";
        let tx: Transaction = deserialize(&hex::decode(tx_hex).unwrap()).unwrap();
        // Taken from mempool.space https://mutinynet.com/address/tb1qvcq8h554lkdvlr60kz23eyfxnd5mlzf6q2j53rtz906a3yvt77tsk6mcwm
        let total_input_amount = Amount::from_sat(245_617);

        // actual_fee_rate is 3253 sats/kw =>  3253 / (1000 / 4) ~= 13.012 sats/vbyte
        let actual_fee_rate = calculate_fee_rate(tx.clone(), total_input_amount);

        // Just to ensure the amounts add up with the paid fee. You can compare these numbers on
        // mempool
        let expected_paid_fee = Amount::from_sat(2_300);
        let paid_fee = calculate_fee_amount(&tx, Amount::from_sat(245_617));
        assert_eq!(paid_fee, expected_paid_fee);

        // next we create a new transaction, based on the inputs and outputs but without the fee,
        // i.e. we add 2_300 sats to the first outputs.
        let mut sample_tx = Transaction {
            version: Version::TWO,
            lock_time: tx.lock_time,
            input: vec![TxIn {
                previous_output: OutPoint::new(
                    Txid::from_str(
                        "2092a30d85651c4a8d2c2968b3db2745ec92b5638402820a4676056c0803f11f",
                    )
                    .expect("to be valud"),
                    0,
                ),
                script_sig: Default::default(),
                sequence: Default::default(),
                witness: Default::default(),
            }],
            output: vec![
                TxOut {
                    value: tx.output[0].value + expected_paid_fee,
                    script_pubkey: tx.output[0].clone().script_pubkey,
                },
                TxOut {
                    value: tx.output[1].value,
                    script_pubkey: tx.output[1].clone().script_pubkey,
                },
            ],
        };

        update_fee(
            13,
            total_input_amount.to_sat(),
            &mut sample_tx,
            ContractVersion::TwoOfThree,
        );
        let paid_fee = calculate_fee_amount(&tx, Amount::from_sat(245_617));
        assert_eq!(paid_fee, expected_paid_fee);

        let sample_fee_rate = calculate_fee_rate(tx.clone(), total_input_amount);
        assert_eq!(sample_fee_rate, actual_fee_rate);
    }

    #[test]
    fn test_dropping_output_due_to_too_low_for_fee() {
        // next we create a new transaction, based on the inputs and outputs but without the fee,
        // i.e. we add 2_300 sats to the first outputs.
        let mut sample_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: vec![TxIn {
                previous_output: OutPoint::new(
                    Txid::from_str(
                        "2092a30d85651c4a8d2c2968b3db2745ec92b5638402820a4676056c0803f11f",
                    )
                    .expect("to be valid"),
                    0,
                ),
                script_sig: Default::default(),
                sequence: Default::default(),
                witness: Default::default(),
            }],
            output: vec![
                TxOut {
                    value: Amount::from_sat(400),
                    script_pubkey: ScriptBuf::default(),
                },
                TxOut {
                    value: Amount::from_sat(1_000_000),
                    script_pubkey: ScriptBuf::default(),
                },
            ],
        };

        update_fee(
            13,
            400 + 1_000_000,
            &mut sample_tx,
            ContractVersion::TwoOfThree,
        );

        assert_eq!(sample_tx.output.len(), 1);
    }
}
