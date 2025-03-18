//! Wallet APIs that depend on browser APIs such as local storage.

use crate::storage::local_storage;
use crate::wallet;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bitcoin::Psbt;
use bitcoin::TxOut;

const STORAGE_KEY_PREFIX: &str = "wallet-v2";

const SEED_STORAGE_KEY: &str = "seed";
const NETWORK_KEY: &str = "network";
const XPUB_KEY: &str = "xpub";

pub struct WalletDetails {
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
}

/// Create a new wallet from implicit entropy.
///
/// The wallet is encrypted with `password` and works only for `network`. The `key` argument is used
/// as part of the browser's local storage entry key for each wallet element.
pub fn new(password: String, network: String) -> Result<WalletDetails> {
    let (mnemonic_ciphertext, network, xpub) = wallet::generate_new(&password, &network)?;

    Ok(WalletDetails {
        mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
        network: network.to_string(),
        xpub: xpub.to_string(),
    })
}

/// Persist a newly created wallet.
///
/// If we pass a `key` that is already used in local storage to hold a wallet, the wallet data for
/// the existing wallet will be moved to a different key.
pub fn persist_new_wallet(
    mnemonic_ciphertext: String,
    network: String,
    xpub: String,
    key: String,
) -> Result<()> {
    let storage = local_storage()?;

    move_wallet_to_other_key(&key).context("Failed to move wallet to other key")?;

    storage.set_item(
        &derive_storage_key(&key, SEED_STORAGE_KEY),
        mnemonic_ciphertext,
    )?;

    storage.set_item(&derive_storage_key(&key, NETWORK_KEY), network)?;

    storage.set_item(&derive_storage_key(&key, XPUB_KEY), xpub)?;

    Ok(())
}

/// Create a new wallet from a given `mnemonic`.
///
/// The wallet is encrypted with `password` and works only for `network`. The `key` argument is used
/// as part of the browser's local storage entry key for each wallet element.
///
/// If we pass a `key` that is already used in local storage to hold a wallet, the wallet data for
/// the existing wallet will be moved to a different key.
pub fn new_from_mnemonic(
    password: String,
    mnemonic: String,
    network: String,
    key: String,
) -> Result<WalletDetails> {
    let storage = local_storage()?;

    move_wallet_to_other_key(&key).context("Failed to move wallet to other key")?;

    let (mnemonic_ciphertext, network, xpub) =
        wallet::new_from_mnemonic(&password, &network, &mnemonic)?;

    storage.set_item(
        &derive_storage_key(&key, SEED_STORAGE_KEY),
        mnemonic_ciphertext.serialize(),
    )?;

    storage.set_item(&derive_storage_key(&key, NETWORK_KEY), network.to_string())?;

    storage.set_item(&derive_storage_key(&key, XPUB_KEY), xpub)?;

    Ok(WalletDetails {
        mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
        network: network.to_string(),
        xpub: xpub.to_string(),
    })
}

/// Restore a wallet from a backup.
///
/// If we pass a `key` that is already used in local storage to hold a wallet, the wallet data for
/// the existing wallet will be moved to a different key.
pub fn restore(
    key: String,
    mnemonic_ciphertext: String,
    network: String,
    xpub: String,
) -> Result<()> {
    let storage = local_storage()?;

    move_wallet_to_other_key(&key).context("Failed to move wallet to other key")?;

    storage.set_item(
        &derive_storage_key(&key, SEED_STORAGE_KEY),
        mnemonic_ciphertext,
    )?;

    storage.set_item(&derive_storage_key(&key, NETWORK_KEY), network)?;

    storage.set_item(&derive_storage_key(&key, XPUB_KEY), xpub)?;

    Ok(())
}

/// Upgrade the wallet to a new format, encrypted under `new_password`. The new format will
/// **generate different keys**, because we no longer use the `old_password` as a passphrase to
/// derive the seed.
pub fn upgrade_wallet(
    key: String,
    mnemonic_ciphertext: String,
    network: String,
    old_password: String,
    new_password: String,
    contract_pks: Vec<String>,
    is_borrower: bool,
) -> Result<WalletDetails> {
    let storage = local_storage()?;

    let (new_mnemonic_ciphertext, new_xpub) = wallet::upgrade_wallet(
        &mnemonic_ciphertext,
        &network,
        &old_password,
        &new_password,
        &contract_pks,
        is_borrower,
    )
    .context("failed to generate upgraded wallet data")?;

    if does_wallet_exist(&key)? {
        bail!("Should not upgrade wallet to PAKE more than once");
    }

    storage
        .set_item(
            &derive_storage_key(&key, SEED_STORAGE_KEY),
            new_mnemonic_ciphertext.serialize(),
        )
        .context("new mnemonic ciphertext")?;

    storage
        .set_item(&derive_storage_key(&key, NETWORK_KEY), &network)
        .context("new network")?;

    storage
        .set_item(&derive_storage_key(&key, XPUB_KEY), new_xpub)
        .context("new Xpub")?;

    Ok(WalletDetails {
        mnemonic_ciphertext: new_mnemonic_ciphertext.serialize(),
        network,
        xpub: new_xpub.to_string(),
    })
}

/// Update the encryption key of the local encrypted wallet to use `new_password` instead of
/// `old_password`.
///
/// If we pass a `key` that is already used in local storage to hold a wallet, the wallet data for
/// the existing wallet will be moved to a different key.
pub fn change_wallet_encryption(
    key: String,
    old_password: String,
    new_password: String,
) -> Result<WalletDetails> {
    let storage = local_storage()?;

    let mnemonic_ciphertext = storage
        .get_item::<String>(&derive_storage_key(&key, SEED_STORAGE_KEY))?
        .context("No mnemonic stored for wallet")?;

    let network = storage
        .get_item::<String>(&derive_storage_key(&key, NETWORK_KEY))?
        .context("No network stored for wallet")?;

    let (new_mnemonic_ciphertext, new_xpub) = wallet::change_wallet_encryption(
        &mnemonic_ciphertext,
        &network,
        &old_password,
        &new_password,
    )
    .context("failed to generate upgraded wallet data")?;

    move_wallet_to_other_key(&key).context("Failed to move wallet to other key")?;

    storage
        .set_item(
            &derive_storage_key(&key, SEED_STORAGE_KEY),
            new_mnemonic_ciphertext.serialize(),
        )
        .context("new mnemonic ciphertext")?;

    storage
        .set_item(&derive_storage_key(&key, NETWORK_KEY), &network)
        .context("new network")?;

    storage
        .set_item(&derive_storage_key(&key, XPUB_KEY), new_xpub)
        .context("new Xpub")?;

    Ok(WalletDetails {
        mnemonic_ciphertext: new_mnemonic_ciphertext.serialize(),
        network,
        xpub: new_xpub.to_string(),
    })
}

pub fn load(password: &str, key: &str) -> Result<()> {
    let storage = local_storage()?;

    let mnemonic_ciphertext = storage
        .get_item::<String>(&derive_storage_key(key, SEED_STORAGE_KEY))?
        .context("No mnemonic stored for wallet")?;

    let network = storage
        .get_item::<String>(&derive_storage_key(key, NETWORK_KEY))?
        .context("No network stored for wallet")?;

    wallet::load_wallet(password, &mnemonic_ciphertext, &network)?;

    Ok(())
}

pub fn sign_claim_psbt(
    psbt: &str,
    collateral_descriptor: &str,
    own_pk: &str,
    derivation_path: Option<&str>,
) -> Result<(String, Vec<TxOut>, bitcoin::params::Params)> {
    let psbt = hex::decode(psbt)?;
    let psbt = Psbt::deserialize(&psbt)?;

    let collateral_descriptor = collateral_descriptor.parse()?;

    let own_pk = own_pk.parse()?;

    let derivation_path = derivation_path.map(|p| p.parse()).transpose()?;

    let tx = wallet::sign_claim_psbt(
        psbt,
        collateral_descriptor,
        own_pk,
        derivation_path.as_ref(),
    )?;

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
    derivation_path: Option<&str>,
) -> Result<(String, Vec<TxOut>, bitcoin::params::Params)> {
    let psbt = hex::decode(psbt)?;
    let psbt = Psbt::deserialize(&psbt)?;

    let collateral_descriptor = collateral_descriptor.parse()?;

    let own_pk = own_pk.parse()?;

    let derivation_path = derivation_path.map(|p| p.parse()).transpose()?;

    let tx = wallet::sign_liquidation_psbt(
        psbt,
        collateral_descriptor,
        own_pk,
        derivation_path.as_ref(),
    )?;

    let outputs = tx.output.clone();
    let params = wallet::consensus_params()?;

    let tx = bitcoin::consensus::encode::serialize_hex(&tx);

    log::debug!("Signed liquidation TX: {tx}");

    Ok((tx, outputs, params))
}

/// Check if the browser's local storage already has the encrypted wallet data.
pub fn does_wallet_exist(key: &str) -> Result<bool> {
    let storage = local_storage()?;

    let mnemonic = storage.get_item::<String>(&derive_storage_key(key, SEED_STORAGE_KEY))?;

    Ok(mnemonic.is_some())
}

/// Check if the wallet stored in local storage matches the arguments to this function.
pub fn is_wallet_equal(
    key: &str,
    mnemonic_ciphertext: &str,
    network: &str,
    xpub: &str,
) -> Result<bool> {
    let storage = local_storage()?;

    let local_mnemonic_ciphertext =
        match storage.get_item::<String>(&derive_storage_key(key, SEED_STORAGE_KEY))? {
            Some(m) => m,
            None => return Ok(false),
        };

    let local_network = match storage.get_item::<String>(&derive_storage_key(key, NETWORK_KEY))? {
        Some(n) => n,
        None => return Ok(false),
    };

    let local_xpub = match storage.get_item::<String>(&derive_storage_key(key, XPUB_KEY))? {
        Some(x) => x,
        None => return Ok(false),
    };

    Ok(local_mnemonic_ciphertext == mnemonic_ciphertext
        && local_network == network
        && local_xpub == xpub)
}

pub fn get_xpub(key: &str) -> Result<String> {
    let storage = local_storage()?;

    let xpub = storage
        .get_item::<String>(&derive_storage_key(key, XPUB_KEY))?
        .context("No xpub found")?;

    Ok(xpub)
}

/// Move a wallet stored in local storage from `key` to `old-key`.
///
/// We move the wallet to avoid overwriting valuable information. In most scenarios the overwritten
/// wallet will not be needed anymore.
fn move_wallet_to_other_key(key: &str) -> Result<()> {
    let storage = local_storage()?;

    let mnemonic_ciphertext =
        storage.get_item::<String>(&derive_storage_key(key, SEED_STORAGE_KEY))?;

    let network = storage.get_item::<String>(&derive_storage_key(key, NETWORK_KEY))?;

    let xpub = storage.get_item::<String>(&derive_storage_key(key, XPUB_KEY))?;

    let (mnemonic_ciphertext, network, xpub) = match (mnemonic_ciphertext, network, xpub) {
        // Nothing to move.
        (None, None, None) => {
            return Ok(());
        }
        // Wallet present in local storage.
        (Some(m), Some(n), Some(x)) => (m, n, x),
        _ => {
            bail!("Cannot move incomplete wallet to other key");
        }
    };

    // We will end up overwriting anything that already lives under `other-key`.
    let mut other_key = "old-".to_string();
    other_key.push_str(key);

    storage.set_item(
        &derive_storage_key(&other_key, SEED_STORAGE_KEY),
        mnemonic_ciphertext,
    )?;

    storage.set_item(&derive_storage_key(&other_key, NETWORK_KEY), network)?;

    storage.set_item(&derive_storage_key(&other_key, XPUB_KEY), xpub)?;

    Ok(())
}

fn derive_storage_key(key: &str, actual_key: &str) -> String {
    let key = key.trim().replace(['\n', '\t', ' '], "_");
    format!("{}.{}.{}", STORAGE_KEY_PREFIX, key, actual_key)
}
