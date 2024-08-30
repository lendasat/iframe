//! Wallet APIs that depend on browser APIs such as local storage.

use crate::storage::local_storage;
use crate::wallet;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;

const PASSPHRASE_STORAGE_KEY: &str = "wallet.passphrase";
const SEED_STORAGE_KEY: &str = "wallet.seed";
const NETWORK_KEY: &str = "wallet.network";
const NEXT_PK_INDEX_KEY: &str = "wallet.next_pk_index";

pub fn new(passphrase: String, network: String) -> Result<()> {
    let storage = local_storage()?;

    if does_wallet_exist()? {
        bail!("Can't create new wallet if it already exists in local storage");
    }

    let (passphrase_hash, mnemonic_ciphertext, network) =
        wallet::new_wallet(&passphrase, &network)?;

    storage.set_item(PASSPHRASE_STORAGE_KEY, passphrase_hash)?;

    storage.set_item(SEED_STORAGE_KEY, mnemonic_ciphertext.serialize())?;

    storage.set_item(NETWORK_KEY, network.to_string())?;

    storage.set_item(NEXT_PK_INDEX_KEY, 0)?;

    Ok(())
}

pub fn load(passphrase: &str) -> Result<()> {
    let storage = local_storage()?;

    let passphrase_hash = storage
        .get_item::<String>(PASSPHRASE_STORAGE_KEY)?
        .context("No passphrase stored for wallet")?;

    let mnemonic_ciphertext = storage
        .get_item::<String>(SEED_STORAGE_KEY)?
        .context("No mnemonic stored for wallet")?;

    let network = storage
        .get_item::<String>(NETWORK_KEY)?
        .context("No network stored for wallet")?;

    wallet::load_wallet(passphrase, &passphrase_hash, &mnemonic_ciphertext, &network)?;

    Ok(())
}

pub fn get_next_pk() -> Result<String> {
    let storage = local_storage()?;

    let pk_index = storage
        .get_item::<u32>(NEXT_PK_INDEX_KEY)?
        .context("No index stored for wallet")?;

    let pk = wallet::get_pk(pk_index)?;

    Ok(pk.to_string())
}

/// Check if the browser's local storage already has the encrypted wallet data.
fn does_wallet_exist() -> Result<bool> {
    let storage = local_storage()?;

    let passphrase = storage.get_item::<String>(PASSPHRASE_STORAGE_KEY)?;
    let mnemonic = storage.get_item::<String>(SEED_STORAGE_KEY)?;

    Ok(passphrase.is_some() || mnemonic.is_some())
}
