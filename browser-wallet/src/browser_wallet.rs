//! Wallet APIs that depend on browser APIs such as local storage.

use crate::storage::local_storage;
use crate::wallet;
use anyhow::Context;
use anyhow::Result;
use bitcoin::Psbt;
use bitcoin::TxOut;

const STORAGE_KEY_PREFIX: &str = "wallet";

const PASSPHRASE_STORAGE_KEY: &str = "passphrase";
const SEED_STORAGE_KEY: &str = "seed";
const NETWORK_KEY: &str = "network";
const XPUB_KEY: &str = "xpub";

pub struct WalletDetails {
    pub passphrase_hash: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
}

/// Create a new wallet
///
/// The wallet is encrypted with [`password`] and works only for [`network`]. The [`key`] is needed
/// to uniquely identify the browser storage. This identifier needs to be unique.
///
/// Notes: if in browser storage a wallet with given [`key`] already exists, it will be overwritten.
pub fn new(passphrase: String, network: String, key: String) -> Result<WalletDetails> {
    let storage = local_storage()?;

    if does_wallet_exist(key.as_str())? {
        log::warn!(
            "Wallet with same name already exists in local storage. It will be overwritten."
        );
    }

    let (passphrase_hash, mnemonic_ciphertext, network, xpub) =
        wallet::new_wallet(&passphrase, &network)?;

    storage.set_item(
        derive_storage_key(key.as_str(), PASSPHRASE_STORAGE_KEY).as_str(),
        passphrase_hash.clone(),
    )?;

    storage.set_item(
        derive_storage_key(key.as_str(), SEED_STORAGE_KEY).as_str(),
        mnemonic_ciphertext.serialize(),
    )?;

    storage.set_item(
        derive_storage_key(key.as_str(), NETWORK_KEY).as_str(),
        network.to_string(),
    )?;

    storage.set_item(derive_storage_key(key.as_str(), XPUB_KEY).as_str(), xpub)?;

    Ok(WalletDetails {
        passphrase_hash: passphrase_hash.to_string(),
        mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
        network: network.to_string(),
        xpub: xpub.to_string(),
    })
}

/// Restores a wallet from provided arguments
///
/// Notes: if in browser storage a wallet with given [`key`] already exists, it will be overwritten.
pub fn restore(
    key: String,
    passphrase_hash: String,
    mnemonic_ciphertext: String,
    network: String,
    xpub: String,
) -> Result<()> {
    let storage = local_storage()?;

    if does_wallet_exist(key.as_str())? {
        log::warn!(
            "Wallet with same name already exists in local storage. It will be overwritten."
        );
    }

    storage.set_item(
        derive_storage_key(key.as_str(), PASSPHRASE_STORAGE_KEY).as_str(),
        passphrase_hash.clone(),
    )?;

    storage.set_item(
        derive_storage_key(key.as_str(), SEED_STORAGE_KEY).as_str(),
        mnemonic_ciphertext,
    )?;

    storage.set_item(
        derive_storage_key(key.as_str(), NETWORK_KEY).as_str(),
        network,
    )?;

    storage.set_item(derive_storage_key(key.as_str(), XPUB_KEY).as_str(), xpub)?;

    Ok(())
}

fn derive_storage_key(key: &str, actual_key: &str) -> String {
    let key = key.trim().replace(['\n', '\t', ' '], "_");
    format!("{}.{}.{}", STORAGE_KEY_PREFIX, key, actual_key)
}

pub fn load(passphrase: &str, key: &str) -> Result<()> {
    let storage = local_storage()?;

    let passphrase_hash = storage
        .get_item::<String>(derive_storage_key(key, PASSPHRASE_STORAGE_KEY).as_str())?
        .context("No passphrase stored for wallet")?;

    let mnemonic_ciphertext = storage
        .get_item::<String>(derive_storage_key(key, SEED_STORAGE_KEY).as_str())?
        .context("No mnemonic stored for wallet")?;

    let network = storage
        .get_item::<String>(derive_storage_key(key, NETWORK_KEY).as_str())?
        .context("No network stored for wallet")?;

    wallet::load_wallet(passphrase, &passphrase_hash, &mnemonic_ciphertext, &network)?;

    Ok(())
}

pub fn get_next_pk() -> Result<String> {
    let pk = wallet::get_pk()?;

    Ok(pk.to_string())
}

pub fn sign_claim_psbt(
    psbt: &str,
    collateral_descriptor: &str,
    own_pk: &str,
) -> Result<(String, Vec<TxOut>, bitcoin::params::Params)> {
    let psbt = hex::decode(psbt)?;
    let psbt = Psbt::deserialize(&psbt)?;

    let collateral_descriptor = collateral_descriptor.parse()?;

    let own_pk = own_pk.parse()?;

    let tx = wallet::sign_claim_psbt(psbt, collateral_descriptor, own_pk)?;

    let outputs = tx.output.clone();
    let params = wallet::consensus_params()?;

    let tx = bitcoin::consensus::encode::serialize_hex(&tx);

    log::debug!("Signed claim TX: {tx}");

    Ok((tx, outputs, params))
}

pub fn sign_liquidation_psbt(
    psbt: &str,
    collateral_descriptor: &str,
    own_pk: &str,
) -> Result<(String, Vec<TxOut>, bitcoin::params::Params)> {
    let psbt = hex::decode(psbt)?;
    let psbt = Psbt::deserialize(&psbt)?;

    let collateral_descriptor = collateral_descriptor.parse()?;

    let own_pk = own_pk.parse()?;

    let tx = wallet::sign_liquidation_psbt(psbt, collateral_descriptor, own_pk)?;

    let outputs = tx.output.clone();
    let params = wallet::consensus_params()?;

    let tx = bitcoin::consensus::encode::serialize_hex(&tx);

    log::debug!("Signed claim TX: {tx}");

    Ok((tx, outputs, params))
}

/// Check if the browser's local storage already has the encrypted wallet data.
pub fn does_wallet_exist(key: &str) -> Result<bool> {
    let storage = local_storage()?;

    let passphrase =
        storage.get_item::<String>(derive_storage_key(key, PASSPHRASE_STORAGE_KEY).as_str())?;
    let mnemonic =
        storage.get_item::<String>(derive_storage_key(key, SEED_STORAGE_KEY).as_str())?;

    Ok(passphrase.is_some() || mnemonic.is_some())
}

pub fn get_xpub(key: &str) -> Result<String> {
    let storage = local_storage()?;

    let xpub = storage
        .get_item::<String>(derive_storage_key(key, XPUB_KEY).as_str())?
        .context("No xpub found")?;

    Ok(xpub)
}
