use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bip39::Mnemonic;
use bitcoin::bip32::DerivationPath;
use bitcoin::bip32::Xpriv;
use bitcoin::bip32::Xpub;
use bitcoin::hex::Case;
use bitcoin::hex::DisplayHex;
use bitcoin::key::Secp256k1;
use bitcoin::Network;
use bitcoin::Psbt;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use client_sdk::wallet::decrypt_mnemonic;
use client_sdk::wallet::derive_encryption_key;
use client_sdk::wallet::does_pk_belong_to_xpub;
use client_sdk::wallet::encrypt_mnemonic_with_passphrase;
use client_sdk::wallet::find_kp_for_borrower_pk_legacy;
use client_sdk::wallet::generate_mnemonic;
use client_sdk::wallet::FiatLoanDetails;
use client_sdk::wallet::MnemonicCiphertext;
use client_sdk::wallet::SignedMessage;
use client_sdk::wallet::Wallet;
use miniscript::Descriptor;
use rand::thread_rng;
use rand::Rng;
use std::str::FromStr as _;
use std::sync::LazyLock;
use std::sync::Mutex;

static WALLET: LazyLock<Mutex<Option<Wallet>>> = LazyLock::new(|| Mutex::new(None));

pub fn generate_new(password: &str, network: &str) -> Result<(MnemonicCiphertext, Network)> {
    log::info!("Generating new wallet");

    let mut rng = thread_rng();

    let mnemonic = generate_mnemonic(&mut rng)?;

    // Start from zero for a new wallet.
    let contract_index = 0;

    let (wallet, mnemonic_ciphertext) =
        Wallet::new(&mut rng, mnemonic, password, network, contract_index)?;
    let network = wallet.network();

    Ok((mnemonic_ciphertext, network))
}

pub fn new_from_mnemonic(
    password: &str,
    network: &str,
    mnemonic: &str,
) -> Result<MnemonicCiphertext> {
    let mut guard = WALLET.lock().expect("to get lock");
    log::info!("Creating new wallet from mnemonic");

    if guard.is_some() {
        log::warn!("Wallet already loaded. Overwriting existing in-memory wallet instance");
    }

    let mnemonic = Mnemonic::from_str(mnemonic)?;

    let mut rng = thread_rng();

    // Start from zero for a wallet restored from a mnemonic.
    let contract_index = 0;

    let (wallet, mnemonic_ciphertext) =
        Wallet::new(&mut rng, mnemonic, password, network, contract_index)?;

    guard.replace(wallet);

    Ok(mnemonic_ciphertext)
}

pub fn load_wallet(
    password: &str,
    mnemonic_ciphertext: &str,
    network: &str,
    contract_index: u32,
) -> Result<()> {
    let mut guard = WALLET.lock().expect("to get lock");

    log::debug!("Loading wallet from input... start");

    if guard.is_some() {
        log::warn!("Wallet already loaded. Overwriting existing in-memory wallet instance");
    }

    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let wallet = Wallet::from_ciphertext(mnemonic_ciphertext, password, network, contract_index)?;

    guard.replace(wallet);
    log::debug!("Loading wallet from input.. done");

    Ok(())
}

pub fn is_wallet_loaded() -> Result<bool> {
    let guard = WALLET.lock().expect("to get lock");
    Ok(guard.is_some())
}

/// Upgrade the wallet to use a different seed (without a passphrase) and use `new_password` as the
/// encryption key for the mnemonic.
///
/// The `old_password` is used to decrypt the `mnemonic_ciphertext`.
///
/// To ensure that the original seed is not lost (some contracts may have already been generated
/// with it), we append the `old_password` at the end of the decrypted mnemonic seed phrase before
/// encrypting with the `new_password`.
pub fn upgrade_wallet(
    mnemonic_ciphertext: &str,
    network: &str,
    old_password: &str,
    new_password: &str,
    // We will check if all these keys can be spent using the wallet that is being upgraded.
    contract_pks: &[String],
    // Used to determine how to verify the `contract_pks`.
    is_borrower: bool,
) -> Result<MnemonicCiphertext> {
    let network = Network::from_str(network).context("Invalid network")?;

    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let old_encryption_key = derive_encryption_key(old_password, &mnemonic_ciphertext.salt())
        .context("Failed to generate old encryption key")?;

    let (mnemonic, old_passphrase) = decrypt_mnemonic(&mnemonic_ciphertext, old_encryption_key)
        .context("Failed to decrypt mnemonic using old encryption key")?;

    // The presence of an `old_pasphrase` in the plaintext signifies that this wallet has been
    // upgraded before.
    if old_passphrase.is_some() {
        bail!("Cannot upgrade a wallet that was already upgraded");
    }

    // Check if the contract PKs returned by the hub can be spent using the legacy Xpriv.
    let seed = mnemonic.to_seed(old_password);
    let legacy_xprv = Xpriv::new_master(network, &seed).context("Failed to derive legacy Xpriv")?;

    if is_borrower {
        for contract_pk in contract_pks.iter() {
            let contract_pk =
                PublicKey::from_str(contract_pk).context("Failed to parse contract PK")?;
            find_kp_for_borrower_pk_legacy(&legacy_xprv, &contract_pk)
                .with_context(|| format!("Cannot spend contract PK: {contract_pk}"))?;

            log::debug!("Can spend contract PK: {contract_pk}");
        }
    } else {
        for contract_pk in contract_pks.iter() {
            let legacy_xpub = Xpub::from_priv(&Secp256k1::new(), &legacy_xprv);

            let contract_pk =
                PublicKey::from_str(contract_pk).context("Failed to parse contract PK")?;
            does_pk_belong_to_xpub(&legacy_xpub, &contract_pk, network)
                .with_context(|| format!("Cannot spend contract PK: {contract_pk}"))?;

            log::debug!("Can spend contract PK: {contract_pk}");
        }
    }

    let new_mnemonic_ciphertext = {
        let mut rng = thread_rng();
        let new_salt = rng.gen::<[u8; 32]>();
        let new_encryption_key = derive_encryption_key(new_password, &new_salt)
            .context("Failed to generate new encryption key")?;

        let ciphertext =
            encrypt_mnemonic_with_passphrase(&mnemonic, old_password, new_encryption_key)
                .context("Failed to encrypt mnemonic with new encryption key")?;

        MnemonicCiphertext::new(new_salt, ciphertext)
    };

    Ok(new_mnemonic_ciphertext)
}

pub fn get_mnemonic() -> Result<String> {
    let guard = WALLET.lock().expect("to get lock");

    let mnemonic = match *guard {
        Some(ref wallet) => wallet.mnemonic(),
        None => {
            bail!("Can't get mnemonic if wallet is not loaded");
        }
    };

    Ok(mnemonic.to_string())
}

/// Used by borrowers.
pub fn sign_claim_psbt(
    psbt: Psbt,
    collateral_descriptor: Descriptor<PublicKey>,
    own_pk: PublicKey,
    // Newer contracts use a derivation path decided by the hub.
    //
    // Older contracts used a local index, unknown to the hub and not backed up. To find the
    // corresponding secret key, we use a heuristic: we look throught the first 100 keys using the
    // common derivation path `586/0/*` (for mainnet) until we find one that matches our public key
    // in the contract i.e. `own_pk`.
    derivation_path: Option<&DerivationPath>,
) -> Result<Transaction> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Can't get keypair if wallet is not loaded");
        }
    };

    let tx = wallet.sign_claim_psbt(psbt, collateral_descriptor, own_pk, derivation_path)?;

    Ok(tx)
}

/// Used by lenders.
pub fn sign_liquidation_psbt(
    psbt: Psbt,
    collateral_descriptor: Descriptor<PublicKey>,
    own_pk: PublicKey,
    derivation_path: Option<&DerivationPath>,
) -> Result<Transaction> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Can't get keypair if wallet is not loaded");
        }
    };

    let tx = wallet.sign_liquidation_psbt(psbt, collateral_descriptor, own_pk, derivation_path)?;

    Ok(tx)
}

pub fn consensus_params() -> Result<bitcoin::params::Params> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Wallet is not loaded");
        }
    };

    let params = match wallet.network() {
        Network::Bitcoin => bitcoin::params::Params::BITCOIN,
        Network::Testnet => bitcoin::params::Params::TESTNET,
        Network::Signet => bitcoin::params::Params::SIGNET,
        Network::Regtest => bitcoin::params::Params::REGTEST,
        _ => unreachable!("Unsupported network"),
    };

    Ok(params)
}

/// Sign a message with secretkey behind the provided pubkey
pub fn sign_message(
    message: &str,
    own_pk: &str,
    derivation_path: Option<&str>,
) -> Result<SignedMessage> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Can't get keypair if wallet is not loaded");
        }
    };

    let own_pk = own_pk.parse()?;
    let derivation_path = derivation_path.map(|p| p.parse()).transpose()?;

    let signed_message = wallet.sign_message(message, own_pk, derivation_path.as_ref())?;

    Ok(signed_message)
}

/// Returns an Nsec derived from the wallet Xprv, encoded as hex.
pub(crate) fn derive_nsec() -> Result<String> {
    let guard = WALLET.lock().expect("to get lock");

    let nsec = match *guard {
        Some(ref wallet) => wallet.nsec()?,
        None => {
            bail!("Can't derive nsec if wallet is not loaded");
        }
    };

    Ok(nsec.secret_bytes().to_hex_string(Case::Lower))
}

pub(crate) fn derive_xpub() -> Result<Xpub> {
    let guard = WALLET.lock().expect("to get lock");

    let xpub = match *guard {
        Some(ref wallet) => wallet.xpub(),
        None => {
            bail!("Can't derive Xpub if wallet is not loaded");
        }
    };

    Ok(xpub)
}

/// Decrypt [`FiatLoanDetails`].
///
/// First we decrypt the `encrypted_encryption_key` using the [`Wallet`]'s `xprv`. This produces the
/// encryption key with which to decrypt all the fields in [`FiatLoanDetails`].
///
/// # Returns
///
/// An instance of [`FiatLoanDetails`] with plaintext values in each field.
pub fn decrypt_fiat_loan_details(
    fiat_loan_details: &FiatLoanDetails,
    encrypted_encryption_key: &str,
    derivation_path: &str,
) -> Result<FiatLoanDetails> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Wallet is not loaded");
        }
    };

    let derivation_path = derivation_path.parse()?;

    let fiat_loan_details = wallet.decrypt_fiat_loan_details(
        fiat_loan_details,
        encrypted_encryption_key,
        &derivation_path,
    )?;

    Ok(fiat_loan_details)
}
