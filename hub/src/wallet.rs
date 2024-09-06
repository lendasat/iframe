use anyhow::Context;
use anyhow::Result;
use bitcoin::absolute::LockTime;
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
use bitcoin::Transaction;
use bitcoin::TxIn;
use bitcoin::TxOut;
use miniscript::Descriptor;
use std::str::FromStr;
use std::sync::LazyLock;
use std::sync::Mutex;

// FIXME: Persist this.
static KEY_INDEX: LazyLock<Mutex<u32>> = LazyLock::new(|| Mutex::new(0));

// FIXME: Pass another xpub in to receive fee payments?
const HUB_FEE_ADDRESS: &str = "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37";

pub struct Wallet {
    hub_xpriv: Xpriv,
    /// We only have the fallback key as an [`Xpub`] because we only want to use the corresponding
    /// [`Xpriv`] _manually_ under extreme circumstances.
    ///
    /// Reminder that the 2-of-3 multisig setup is _temporary_ and will disappear when we start
    /// using DLCs.
    fallback_xpub: Xpub,
    network: Network,
}

impl Wallet {
    pub fn new(hub_seed: Vec<u8>, fallback_xpub: &str, network: Network) -> Result<Self> {
        let hub_xpriv = Xpriv::new_master(NetworkKind::from(network), &hub_seed)?;
        let fallback_xpub = Xpub::from_str(fallback_xpub)?;

        Ok(Self {
            hub_xpriv,
            fallback_xpub,
            network,
        })
    }

    /// Generate a collateral contract address for a borrower.
    pub fn contract_address(&self, borrower_pk: PublicKey) -> Result<(Address, u32)> {
        let (hub_pk, fallback_pk, index) = self.derive_next_pks()?;

        // TODO: Extract into a function.
        let descriptor: Descriptor<PublicKey> =
            format!("wsh(multi(2,{borrower_pk},{hub_pk},{fallback_pk}))").parse()?;

        let address = descriptor.address(self.network)?;

        Ok((address, index))
    }

    pub fn create_claim_collateral_psbt(
        &self,
        borrower_pk: PublicKey,
        contract_index: u32,
        collateral_output: OutPoint,
        collateral_amount: u64,
        // In the DLC-based protocol, we will probably charge the origination fee when the
        // collateral is locked up.
        origination_fee: u64,
        borrower_btc_address: Address,
    ) -> Result<(Psbt, Descriptor<PublicKey>)> {
        let (hub_kp, fallback_pk) = self.get_keys_for_index(contract_index)?;

        let hub_pk = PublicKey::new(hub_kp.public_key());
        let collateral_descriptor: Descriptor<PublicKey> =
            format!("wsh(multi(2,{borrower_pk},{hub_pk},{fallback_pk}))").parse()?;

        let collateral_input = TxIn {
            previous_output: collateral_output,
            ..Default::default()
        };

        // FIXME: Incorrect arbitrary value!
        let tx_weight_vb = 250;
        // FIXME: Choose a sensible fee rate.
        let fee_rate_spvb = 1;

        let tx_fee = tx_weight_vb * fee_rate_spvb;

        let claim_amount = collateral_amount
            .checked_sub(origination_fee + tx_fee)
            .context("Negative claim amount")?;

        let claim_output = TxOut {
            value: Amount::from_sat(claim_amount),
            script_pubkey: borrower_btc_address.script_pubkey(),
        };

        let address = Address::from_str(HUB_FEE_ADDRESS).expect("valid address");

        let origination_fee_output = TxOut {
            value: Amount::from_sat(origination_fee),
            script_pubkey: address.assume_checked().script_pubkey(),
        };

        let unsigned_claim_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: vec![collateral_input],
            output: vec![claim_output, origination_fee_output],
        };

        let witness_script = collateral_descriptor.script_code()?;
        let sighash = SighashCache::new(&unsigned_claim_tx).p2wsh_signature_hash(
            0,
            &witness_script,
            Amount::from_sat(collateral_amount + origination_fee),
            EcdsaSighashType::All,
        )?;

        let mut claim_psbt = Psbt::from_unsigned_tx(unsigned_claim_tx)?;

        let mut input = psbt::Input {
            witness_utxo: Some(TxOut {
                value: Amount::from_sat(collateral_amount + origination_fee),
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

        claim_psbt.inputs = vec![input];

        Ok((claim_psbt, collateral_descriptor))
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

            let child_xpub = self.fallback_xpub.derive_pub(&secp, &path)?;
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
    fn derive_next_pks(&self) -> Result<(PublicKey, PublicKey, u32)> {
        let mut key_index = KEY_INDEX.lock().expect("to get lock");
        let index = *key_index;

        let (hub_kp, fallback_pk) = self.get_keys_for_index(index)?;

        let hub_pk = PublicKey::new(hub_kp.public_key());

        *key_index += 1;

        Ok((hub_pk, fallback_pk, index))
    }
}
