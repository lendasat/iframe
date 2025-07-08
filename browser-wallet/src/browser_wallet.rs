//! Wallet APIs that depend on browser APIs such as local storage.

use crate::storage::local_storage;
use crate::wallet;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bitcoin::bip32;
use bitcoin::key::Secp256k1;
use bitcoin::Address;
use bitcoin::CompressedPublicKey;
use bitcoin::Network;
use bitcoin::Psbt;
use bitcoin::PublicKey;
use bitcoin::TxOut;
use nostr::ToBech32;

const STORAGE_KEY_PREFIX: &str = "wallet-v2";

const SEED_STORAGE_KEY: &str = "seed";
const NETWORK_KEY: &str = "network";
const CONTRACT_INDEX_KEY: &str = "index";
const NSEC_KEY: &str = "nsec";
const XPUB_KEY: &str = "xpub";

pub struct WalletDetails {
    pub mnemonic_ciphertext: String,
    pub network: String,
}

/// Create a new wallet from implicit entropy.
///
/// The wallet is encrypted with `password` and works only for `network`. The `key` argument is used
/// as part of the browser's local storage entry key for each wallet element.
pub fn new(password: String, network: String) -> Result<WalletDetails> {
    let (mnemonic_ciphertext, network) = wallet::generate_new(&password, &network)?;

    Ok(WalletDetails {
        mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
        network: network.to_string(),
    })
}

/// Persist a newly created wallet.
///
/// If we pass a `key` that is already used in local storage to hold a wallet, the wallet data for
/// the existing wallet will be moved to a different key.
pub fn persist_new_wallet(mnemonic_ciphertext: String, network: String, key: String) -> Result<()> {
    let storage = local_storage()?;

    move_wallet_to_other_key(&key).context("Failed to move wallet to other key")?;

    storage.set_item(
        &derive_storage_key(&key, SEED_STORAGE_KEY),
        mnemonic_ciphertext,
    )?;

    storage.set_item(&derive_storage_key(&key, NETWORK_KEY), network)?;

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

    let mnemonic_ciphertext = wallet::new_from_mnemonic(&password, &network, &mnemonic)?;

    storage.set_item(
        &derive_storage_key(&key, SEED_STORAGE_KEY),
        mnemonic_ciphertext.serialize(),
    )?;

    storage.set_item(&derive_storage_key(&key, NETWORK_KEY), network.clone())?;

    Ok(WalletDetails {
        mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
        network: network.to_string(),
    })
}

/// Restore a wallet from a backup.
///
/// If we pass a `key` that is already used in local storage to hold a wallet, the wallet data for
/// the existing wallet will be moved to a different key.
pub fn restore(key: String, mnemonic_ciphertext: String, network: String) -> Result<()> {
    let storage = local_storage()?;

    move_wallet_to_other_key(&key).context("Failed to move wallet to other key")?;

    storage.set_item(
        &derive_storage_key(&key, SEED_STORAGE_KEY),
        mnemonic_ciphertext,
    )?;

    storage.set_item(&derive_storage_key(&key, NETWORK_KEY), network)?;

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

    let new_mnemonic_ciphertext = wallet::upgrade_wallet(
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

    Ok(WalletDetails {
        mnemonic_ciphertext: new_mnemonic_ciphertext.serialize(),
        network,
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

    let new_mnemonic_ciphertext = client_sdk::wallet::change_wallet_encryption(
        &mnemonic_ciphertext,
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

    Ok(WalletDetails {
        mnemonic_ciphertext: new_mnemonic_ciphertext.serialize(),
        network,
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

    let contract_index_key = &derive_storage_key(key, CONTRACT_INDEX_KEY);

    let contract_index = match storage.get_item::<u32>(contract_index_key)? {
        Some(index) => index,
        None => {
            let index = 0;
            storage.set_item(contract_index_key, index)?;
            index
        }
    };

    wallet::load_wallet(password, &mnemonic_ciphertext, &network, contract_index)?;

    let nsec = wallet::derive_nsec()?;
    let nsec_key = &derive_storage_key(key, NSEC_KEY);
    storage.set_item(nsec_key, nsec)?;
    log::debug!("Set Nsec in storage");

    let xpub = wallet::derive_xpub()?;
    let xpub_key = &derive_storage_key(key, XPUB_KEY);
    storage.set_item(xpub_key, xpub)?;
    log::debug!("Set Xpub in storage");

    Ok(())
}

pub fn get_next_normal_pk(key: String) -> Result<(PublicKey, bip32::DerivationPath)> {
    let storage = local_storage()?;

    let xpub_key = derive_storage_key(&key, XPUB_KEY);
    let xpub = storage
        .get_item::<String>(&xpub_key)?
        .context(format!("No Xpub stored in storage key {xpub_key}"))?;

    let xpub = xpub.parse()?;

    let contract_index_key = &derive_storage_key(&key, CONTRACT_INDEX_KEY);

    let contract_index = storage
        .get_item::<u32>(contract_index_key)?
        .unwrap_or_default();

    let (pk, path) = client_sdk::wallet::derive_next_normal_pk_multisig(xpub, contract_index)?;

    // After using the contract index, we increment it so that the next generated key is different.
    storage.set_item(contract_index_key, contract_index + 1)?;

    Ok((pk, path))
}

pub fn get_nsec(key: String) -> Result<String> {
    let storage = local_storage()?;

    let storage_key = derive_storage_key(key.as_str(), NSEC_KEY);
    let nsec = storage
        .get_item::<String>(&storage_key)?
        .context(format!("No nsec stored in storage {storage_key}"))?;

    Ok(nsec)
}

pub fn get_npub(key: String) -> Result<String> {
    let nsec = get_nsec(key)?;
    let nsec = nostr::SecretKey::parse(nsec.as_str())?;
    let public_key = nsec.public_key(&Secp256k1::new());

    let npub = nostr::key::PublicKey::from_slice(&public_key.x_only_public_key().0.serialize())?;

    Ok(npub.to_bech32()?)
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
pub fn is_wallet_equal(key: &str, mnemonic_ciphertext: &str, network: &str) -> Result<bool> {
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

    Ok(local_mnemonic_ciphertext == mnemonic_ciphertext && local_network == network)
}

/// Generate a single-sig [`bitcoin::Address`] based on the Xpub stored in local storage.
///
/// This function is meant to be used to send sats directly to the owner of this browser wallet.
/// This is only used for convenience (better UX), as it is usually preferable to let the user
/// choose and address from an external wallet.
pub fn get_next_address(key: String) -> Result<Address> {
    let storage = local_storage()?;

    let xpub_key = derive_storage_key(&key, XPUB_KEY);
    let xpub = storage
        .get_item::<String>(&xpub_key)?
        .context(format!("No Xpub stored in storage key {xpub_key}"))?;

    let xpub = xpub.parse()?;

    let contract_index_key = &derive_storage_key(&key, CONTRACT_INDEX_KEY);

    let contract_index = storage
        .get_item::<u32>(contract_index_key)?
        .unwrap_or_default();

    let (pk, _) = client_sdk::wallet::derive_next_normal_pk_singlesig(xpub, contract_index)?;

    let network_key = &derive_storage_key(&key, NETWORK_KEY);
    let network = storage
        .get_item::<String>(network_key)?
        .context(format!("No network stored in storage key {network_key}"))?;
    let network: Network = network.parse().context("Invalid network")?;

    let address = Address::p2wpkh(&CompressedPublicKey(pk.inner), network);

    // After using the contract index, we increment it so that the next generated key is different.
    storage.set_item(contract_index_key, contract_index + 1)?;

    Ok(address)
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

    let (mnemonic_ciphertext, network) = match (mnemonic_ciphertext, network) {
        // Nothing to move.
        (None, None) => {
            return Ok(());
        }
        // Wallet present in local storage.
        (Some(m), Some(n)) => (m, n),
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

    Ok(())
}

fn derive_storage_key(key: &str, actual_key: &str) -> String {
    let key = key.trim().replace(['\n', '\t', ' '], "_");
    format!("{STORAGE_KEY_PREFIX}.{key}.{actual_key}")
}
