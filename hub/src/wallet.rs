use anyhow::Result;
use bitcoin::bip32::ChildNumber;
use bitcoin::bip32::Xpriv;
use bitcoin::bip32::Xpub;
use bitcoin::key::Secp256k1;
use bitcoin::Address;
use bitcoin::Network;
use bitcoin::NetworkKind;
use bitcoin::PublicKey;
use miniscript::Descriptor;
use std::str::FromStr;
use std::sync::LazyLock;
use std::sync::Mutex;

// TODO: Make this dynamic.
const NETWORK: Network = Network::Regtest;

// FIXME: Persist this.
static KEY_INDEX: LazyLock<Mutex<u32>> = LazyLock::new(|| Mutex::new(0));

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
    pub fn new(hub_seed: Vec<u8>, fallback_xpub: &str) -> Result<Self> {
        let network = NETWORK;

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

        let descriptor: Descriptor<PublicKey> =
            format!("wsh(multi(2,{borrower_pk},{hub_pk},{fallback_pk}))").parse()?;

        let address = descriptor.address(self.network)?;

        Ok((address, index))
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

        let mut key_index = KEY_INDEX.lock().expect("to get lock");

        let index = *key_index;

        let secp = Secp256k1::new();

        let hub_pk = {
            let path = [
                ChildNumber::from_hardened_idx(586).expect("infallible"),
                network_harderned_index,
                ChildNumber::from_hardened_idx(index).unwrap(),
            ];

            let child_xpriv = self.hub_xpriv.derive_priv(&secp, &path)?;
            PublicKey::new(child_xpriv.to_keypair(&secp).public_key())
        };

        let fallback_pk = {
            let path = [
                ChildNumber::from_normal_idx(586).expect("infallible"),
                network_normal_index,
                ChildNumber::from_normal_idx(index).unwrap(),
            ];

            let child_xpub = self.fallback_xpub.derive_pub(&secp, &path)?;
            PublicKey::new(child_xpub.public_key)
        };

        *key_index += 1;

        Ok((hub_pk, fallback_pk, index))
    }
}
