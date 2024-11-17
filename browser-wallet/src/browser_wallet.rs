//! Wallet APIs that depend on browser APIs such as local storage.

use crate::storage::local_storage;
use crate::wallet;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bitcoin::Psbt;

const STORAGE_KEY_PREFIX: &str = "wallet";

const PASSPHRASE_STORAGE_KEY: &str = "passphrase";
const SEED_STORAGE_KEY: &str = "seed";
const NETWORK_KEY: &str = "network";
const NEXT_PK_INDEX_KEY: &str = "next_pk_index";
const XPUB_KEY: &str = "xpub";

pub struct WalletDetails {
    pub passphrase_hash: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
}

pub fn new(passphrase: String, network: String, username: String) -> Result<WalletDetails> {
    let storage = local_storage()?;

    if does_wallet_exist(username.as_str())? {
        bail!("Can't create new wallet if it already exists in local storage");
    }

    let (passphrase_hash, mnemonic_ciphertext, network, xpub) =
        wallet::new_wallet(&passphrase, &network)?;

    storage.set_item(
        derive_storage_key(username.as_str(), PASSPHRASE_STORAGE_KEY).as_str(),
        passphrase_hash.clone(),
    )?;

    storage.set_item(
        derive_storage_key(username.as_str(), SEED_STORAGE_KEY).as_str(),
        mnemonic_ciphertext.serialize(),
    )?;

    storage.set_item(
        derive_storage_key(username.as_str(), NETWORK_KEY).as_str(),
        network.to_string(),
    )?;

    storage.set_item(
        derive_storage_key(username.as_str(), NEXT_PK_INDEX_KEY).as_str(),
        0,
    )?;

    storage.set_item(
        derive_storage_key(username.as_str(), XPUB_KEY).as_str(),
        xpub,
    )?;

    Ok(WalletDetails {
        passphrase_hash: passphrase_hash.to_string(),
        mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
        network: network.to_string(),
        xpub: xpub.to_string(),
    })
}

pub fn restore(
    username: String,
    passphrase_hash: String,
    mnemonic_ciphertext: String,
    network: String,
    xpub: String,
) -> Result<()> {
    let storage = local_storage()?;

    if does_wallet_exist(username.as_str())? {
        bail!("Can't create new wallet if it already exists in local storage");
    }

    storage.set_item(
        derive_storage_key(username.as_str(), PASSPHRASE_STORAGE_KEY).as_str(),
        passphrase_hash.clone(),
    )?;

    storage.set_item(
        derive_storage_key(username.as_str(), SEED_STORAGE_KEY).as_str(),
        mnemonic_ciphertext,
    )?;

    storage.set_item(
        derive_storage_key(username.as_str(), NETWORK_KEY).as_str(),
        network,
    )?;

    // TODO: is this safe?
    storage.set_item(
        derive_storage_key(username.as_str(), NEXT_PK_INDEX_KEY).as_str(),
        0,
    )?;

    storage.set_item(
        derive_storage_key(username.as_str(), XPUB_KEY).as_str(),
        xpub,
    )?;

    Ok(())
}

fn derive_storage_key(username: &str, actual_key: &str) -> String {
    let username = username.trim().replace(['\n', '\t', ' '], "_");
    format!("{}.{}.{}", STORAGE_KEY_PREFIX, username, actual_key)
}

pub fn load(passphrase: &str, username: &str) -> Result<()> {
    let storage = local_storage()?;

    let passphrase_hash = storage
        .get_item::<String>(derive_storage_key(username, PASSPHRASE_STORAGE_KEY).as_str())?
        .context("No passphrase stored for wallet")?;

    let mnemonic_ciphertext = storage
        .get_item::<String>(derive_storage_key(username, SEED_STORAGE_KEY).as_str())?
        .context("No mnemonic stored for wallet")?;

    let network = storage
        .get_item::<String>(derive_storage_key(username, NETWORK_KEY).as_str())?
        .context("No network stored for wallet")?;

    wallet::load_wallet(passphrase, &passphrase_hash, &mnemonic_ciphertext, &network)?;

    Ok(())
}

pub fn get_next_pk(username: &str) -> Result<String> {
    let storage = local_storage()?;

    let pk_index = storage
        .get_item::<u32>(derive_storage_key(username, NEXT_PK_INDEX_KEY).as_str())?
        .context("No index stored for wallet")?;

    let pk = wallet::get_pk(pk_index)?;

    storage.set_item(
        derive_storage_key(username, &pk.to_string()).as_str(),
        pk_index,
    )?;

    storage.set_item(
        derive_storage_key(username, NEXT_PK_INDEX_KEY).as_str(),
        pk_index + 1,
    )?;

    Ok(pk.to_string())
}

pub fn sign_claim_psbt(
    psbt: &str,
    collateral_descriptor: &str,
    pk: &str,
    username: &str,
) -> Result<String> {
    let storage = local_storage()?;

    let pk_index = storage
        .get_item::<u32>(derive_storage_key(username, pk).as_str())?
        .with_context(|| format!("No pk index for pk {pk}"))?;

    let psbt = hex::decode(psbt)?;
    let psbt = Psbt::deserialize(&psbt)?;

    let collateral_descriptor = collateral_descriptor.parse()?;

    let tx = wallet::sign_claim_psbt(psbt, collateral_descriptor, pk_index)?;
    let tx = bitcoin::consensus::encode::serialize_hex(&tx);

    Ok(tx)
}

/// Check if the browser's local storage already has the encrypted wallet data.
pub fn does_wallet_exist(username: &str) -> Result<bool> {
    let storage = local_storage()?;

    let passphrase = storage
        .get_item::<String>(derive_storage_key(username, PASSPHRASE_STORAGE_KEY).as_str())?;
    let mnemonic =
        storage.get_item::<String>(derive_storage_key(username, SEED_STORAGE_KEY).as_str())?;

    Ok(passphrase.is_some() || mnemonic.is_some())
}

pub fn get_xpub(username: &str) -> Result<String> {
    let storage = local_storage()?;

    let xpub = storage
        .get_item::<String>(derive_storage_key(username, XPUB_KEY).as_str())?
        .context("No xpub found")?;

    Ok(xpub)
}
