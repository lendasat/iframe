use aes_gcm_siv::aead::Aead;
use aes_gcm_siv::Aes256GcmSiv;
use aes_gcm_siv::KeyInit;
use anyhow::anyhow;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bip39::Mnemonic;
use bitcoin::bip32::ChildNumber;
use bitcoin::bip32::DerivationPath;
use bitcoin::bip32::Xpriv;
use bitcoin::bip32::Xpub;
use bitcoin::hex::Case;
use bitcoin::hex::DisplayHex;
use bitcoin::key::Keypair;
use bitcoin::key::Secp256k1;
use bitcoin::secp256k1::SecretKey;
use bitcoin::sighash::SighashCache;
use bitcoin::EcdsaSighashType;
use bitcoin::Network;
use bitcoin::NetworkKind;
use bitcoin::Psbt;
use bitcoin::PublicKey;
use bitcoin::Transaction;
use hkdf::Hkdf;
use miniscript::psbt::PsbtExt;
use miniscript::Descriptor;
use rand::thread_rng;
use rand::CryptoRng;
use rand::Rng;
use sha2::Digest;
use sha2::Sha256;
use std::str::FromStr;
use std::sync::LazyLock;
use std::sync::Mutex;

const SECRET_KEY_ENCRYPTION_NONCE: &[u8; 12] = b"SECRET_KEY!!";

const NSEC_DERIVATION_PATH: &str = "m/44/0/0/0/0";

/// Index used to derive new keypairs from the wallet's [`Xpub`].
///
/// At the moment, we use a constant value for simplicity, but we should change this.
const KEY_INDEX: u32 = 0;

static WALLET: LazyLock<Mutex<Option<Wallet>>> = LazyLock::new(|| Mutex::new(None));

struct Wallet {
    /// We keep this so that we can display it to the user.
    mnemonic: Mnemonic,
    xprv: Xpriv,
    /// Wallets generated before the upgrade to users only having a single password will have a
    /// legacy [`Xpriv`]. This key will be used to spend those collateral outputs that were created
    /// before the upgrade.
    ///
    /// The key difference between the normal [`Xpriv`] and the legacy one is that the legacy one
    /// is derived using the `mnemonic` _plus_ a passphrase.
    legacy_xprv: Option<Xpriv>,
    network: Network,
}

pub struct MnemonicCiphertext {
    salt: [u8; 32],
    inner: Vec<u8>,
}

pub fn generate_new(password: &str, network: &str) -> Result<(MnemonicCiphertext, Network, Xpub)> {
    log::info!("Generating new wallet");

    let mut rng = thread_rng();

    let mnemonic = generate_mnemonic(&mut rng)?;

    let (wallet, mnemonic_ciphertext) = Wallet::new(&mut rng, mnemonic, password, network)?;
    let network = wallet.network;
    let xpub = Xpub::from_priv(&Secp256k1::new(), &wallet.xprv);

    Ok((mnemonic_ciphertext, network, xpub))
}

pub fn new_from_mnemonic(
    password: &str,
    network: &str,
    mnemonic: &str,
) -> Result<(MnemonicCiphertext, Network, Xpub)> {
    let mut guard = WALLET.lock().expect("to get lock");
    log::info!("Creating new wallet from mnemonic");

    if guard.is_some() {
        log::warn!("Wallet already loaded. Overwriting existing in-memory wallet instance");
    }

    let mnemonic = Mnemonic::from_str(mnemonic)?;

    let mut rng = thread_rng();

    let (wallet, mnemonic_ciphertext) = Wallet::new(&mut rng, mnemonic, password, network)?;
    let network = wallet.network;
    let xpub = Xpub::from_priv(&Secp256k1::new(), &wallet.xprv);

    guard.replace(wallet);

    Ok((mnemonic_ciphertext, network, xpub))
}

pub fn load_wallet(password: &str, mnemonic_ciphertext: &str, network: &str) -> Result<()> {
    let mut guard = WALLET.lock().expect("to get lock");

    log::debug!("Loading wallet from input... start");

    if guard.is_some() {
        log::warn!("Wallet already loaded. Overwriting existing in-memory wallet instance");
    }

    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let wallet = Wallet::from_ciphertext(mnemonic_ciphertext, password, network)?;

    guard.replace(wallet);
    log::debug!("Loading wallet from input.. done");

    Ok(())
}

pub fn is_wallet_loaded() -> Result<bool> {
    let guard = WALLET.lock().expect("to get lock");
    Ok(guard.is_some())
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

pub fn get_normal_pk_for_network(xpub: &str, network: &str) -> Result<PublicKey> {
    get_normal_pk_for_network_and_index(xpub, network, KEY_INDEX)
}

pub fn get_normal_pk_for_network_and_index(
    xpub: &str,
    network: &str,
    index: u32,
) -> Result<PublicKey> {
    let xpub = Xpub::from_str(xpub).context("Invalid Xpub")?;
    let network = Network::from_str(network).context("Invalid network")?;
    let network = NetworkKind::from(network);

    let network_index = if network.is_mainnet() {
        ChildNumber::from_normal_idx(0).expect("infallible")
    } else {
        ChildNumber::from_normal_idx(1).expect("infallible")
    };

    let path = [
        ChildNumber::from_normal_idx(586).expect("infallible"),
        network_index,
        ChildNumber::from_normal_idx(index).expect("infallible"),
    ];

    let pk = xpub.derive_pub(&Secp256k1::new(), &path)?.public_key;
    let pk = PublicKey::new(pk);

    Ok(pk)
}

fn get_hardened_kp_for_network(
    legacy_xprv: &Xpriv,
    index: u32,
    network: NetworkKind,
) -> Result<Keypair> {
    let network_index = if network.is_mainnet() {
        ChildNumber::from_hardened_idx(0).expect("infallible")
    } else {
        ChildNumber::from_hardened_idx(1).expect("infallible")
    };

    let path = [
        // Random number copied from
        // https://github.com/MutinyWallet/mutiny-node/blob/f71300680ff20381aae07e5e64d5fd6802d21a43/mutiny-core/src/dlc/mod.rs#L126.
        ChildNumber::from_hardened_idx(586).expect("infallible"),
        network_index,
        ChildNumber::from_hardened_idx(index).expect("infallible"),
    ];

    let sk = legacy_xprv
        .derive_priv(&Secp256k1::new(), &path)?
        .private_key;

    let kp = Keypair::from_secret_key(&Secp256k1::new(), &sk);

    Ok(kp)
}

fn get_normal_kp_for_network(xprv: &Xpriv, index: u32, network: NetworkKind) -> Result<Keypair> {
    let network_index = if network.is_mainnet() {
        ChildNumber::from_normal_idx(0).expect("infallible")
    } else {
        ChildNumber::from_normal_idx(1).expect("infallible")
    };

    let path = [
        ChildNumber::from_normal_idx(586).expect("infallible"),
        network_index,
        ChildNumber::from_normal_idx(index).expect("infallible"),
    ];

    let sk = xprv.derive_priv(&Secp256k1::new(), &path)?.private_key;
    let kp = Keypair::from_secret_key(&Secp256k1::new(), &sk);

    Ok(kp)
}

/// Used by borrowers.
pub fn sign_claim_psbt(
    mut psbt: Psbt,
    collateral_descriptor: Descriptor<PublicKey>,
    own_pk: PublicKey,
) -> Result<Transaction> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Can't get keypair if wallet is not loaded");
        }
    };

    let network = wallet.network.into();
    let res =
        find_kp_for_pk(&wallet.xprv, network, &own_pk).context("Could not find keypair to sign");

    let kp = match res {
        Ok(kp) => kp,
        Err(e) => {
            if let Some(legacy_xprv) = wallet.legacy_xprv {
                log::warn!("Falling back to legacy Xpriv: {e}");

                find_kp_for_borrower_pk_legacy(&legacy_xprv, &own_pk)
                    .context("Could not find keypair to sign using legacy Xpriv")?
            } else {
                bail!(e);
            }
        }
    };

    let sk = kp.secret_key();
    let pk = PublicKey::new(kp.public_key());

    let secp = Secp256k1::new();
    for (i, input) in psbt.inputs.iter_mut().enumerate() {
        let collateral_amount = input.clone().witness_utxo.context("No witness UTXO")?.value;

        let sighash = SighashCache::new(&psbt.unsigned_tx)
            .p2wsh_signature_hash(
                i,
                &collateral_descriptor
                    .script_code()
                    .context("No script code")?,
                collateral_amount,
                EcdsaSighashType::All,
            )
            .context("Can't produce sighash cache")?;

        let sig = secp.sign_ecdsa(&sighash.into(), &sk);

        input.partial_sigs.insert(
            pk,
            bitcoin::ecdsa::Signature {
                signature: sig,
                sighash_type: EcdsaSighashType::All,
            },
        );
    }

    let psbt = psbt
        .finalize(&secp)
        .map_err(|e| anyhow!("Failed to finalize PSBT: {e:?}"))?;

    let tx = psbt.extract(&secp).context("Could not extract signed TX")?;

    Ok(tx)
}

/// Used by lenders.
pub fn sign_liquidation_psbt(
    mut psbt: Psbt,
    collateral_descriptor: Descriptor<PublicKey>,
    own_pk: PublicKey,
) -> Result<Transaction> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Can't get keypair if wallet is not loaded");
        }
    };

    let network = wallet.network.into();
    let res =
        find_kp_for_pk(&wallet.xprv, network, &own_pk).context("Could not find keypair to sign");

    let kp = match res {
        Ok(kp) => kp,
        Err(e) => {
            if let Some(legacy_xprv) = wallet.legacy_xprv {
                log::warn!("Falling back to legacy Xpriv: {e}");

                find_kp_for_pk(&legacy_xprv, wallet.network.into(), &own_pk)
                    .context("Could not find keypair to sign using legacy Xpriv")?
            } else {
                bail!(e);
            }
        }
    };

    let sk = kp.secret_key();

    let secp = Secp256k1::new();
    for (i, input) in psbt.inputs.iter_mut().enumerate() {
        let collateral_amount = input.clone().witness_utxo.context("No witness UTXO")?.value;

        let sighash = SighashCache::new(&psbt.unsigned_tx)
            .p2wsh_signature_hash(
                i,
                &collateral_descriptor
                    .script_code()
                    .context("No script code")?,
                collateral_amount,
                EcdsaSighashType::All,
            )
            .context("Can't produce sighash cache")?;

        let sig = secp.sign_ecdsa(&sighash.into(), &sk);

        input.partial_sigs.insert(
            own_pk,
            bitcoin::ecdsa::Signature {
                signature: sig,
                sighash_type: EcdsaSighashType::All,
            },
        );
    }

    let psbt = psbt
        .finalize(&secp)
        .map_err(|e| anyhow!("Failed to finalize PSBT: {e:?}"))?;

    let tx = psbt.extract(&secp).context("Could not extract signed TX")?;

    Ok(tx)
}

/// Find the [`KeyPair`] corresponding to the given [`PublicKey`].
///
/// This builds on the assumption that the [`PublicKey`] was derived from the [`Wallet`]'s
/// [`Xpriv`].
fn find_kp_for_borrower_pk_legacy(legacy_xprv: &Xpriv, pk: &PublicKey) -> Result<Keypair> {
    // We have to try both network types no matter what, because we had a bug that would derive the
    // `Xpriv` using the wrong network. Since we use the `Xpriv`'s network as part of the derivation
    // path, we can end up missing the correct keypair if we don't try both.
    //
    // See patch https://github.com/lendasat/lendasat/commit/8f14fc2.
    // See issue https://github.com/lendasat/lendasat/issues/345.
    let networks = [NetworkKind::Main, NetworkKind::Test];

    let n = 100;
    for i in 0..n {
        for network in networks {
            log::info!("Looking for keypair matching public key {pk}; trying index {i} and network {network:?}");
            let kp =
                get_hardened_kp_for_network(legacy_xprv, i, network).context("No kp for index")?;

            if kp.public_key() == pk.inner {
                log::info!(
                    "Found keypair matching public key {pk} at index {i} and network {network:?}"
                );

                return Ok(kp);
            }
        }
    }

    bail!("Could not find keypair for public key {pk} after {n} iterations");
}

/// Check if the given [`PublicKey`] was generated by the given [`Xpub`].
fn does_pk_belong_to_xpub(xpub: &Xpub, target_pk: &PublicKey, network: Network) -> Result<()> {
    let xpub_str = xpub.to_string();
    let network_str = network.to_string();

    let n = 100;
    for i in 0..n {
        let pk = get_normal_pk_for_network_and_index(&xpub_str, &network_str, i)
            .context("No PK for index")?;

        if pk == *target_pk {
            return Ok(());
        }
    }

    bail!("Could not find PK match after {n} iterations");
}

pub fn consensus_params() -> Result<bitcoin::params::Params> {
    let guard = WALLET.lock().expect("to get lock");
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Wallet is not loaded");
        }
    };

    let params = match wallet.network {
        Network::Bitcoin => bitcoin::params::Params::BITCOIN,
        Network::Testnet => bitcoin::params::Params::TESTNET,
        Network::Signet => bitcoin::params::Params::SIGNET,
        Network::Regtest => bitcoin::params::Params::REGTEST,
        _ => unreachable!("Unsupported network"),
    };

    Ok(params)
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
) -> Result<(MnemonicCiphertext, Xpub)> {
    let network = Network::from_str(network).context("Invalid network")?;

    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let old_encryption_key = derive_encryption_key(old_password, &mnemonic_ciphertext.salt)
        .context("Failed to generate old encryption key")?;

    let (mnemonic, old_passphrase) =
        decrypt_mnemonic(mnemonic_ciphertext.inner, old_encryption_key)
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

    let new_xpub = {
        // The password is _not_ used as a passphrase to allow the user to change it without
        // changing the `Xpriv`.
        let seed = mnemonic.to_seed("");
        let xprv = Xpriv::new_master(network, &seed).context("Failed to derive new Xpriv")?;

        Xpub::from_priv(&Secp256k1::new(), &xprv)
    };

    let new_mnemonic_ciphertext = {
        let mut rng = thread_rng();
        let new_salt = rng.gen::<[u8; 32]>();
        let new_encryption_key = derive_encryption_key(new_password, &new_salt)
            .context("Failed to generate new encryption key")?;

        let ciphertext =
            encrypt_mnemonic_with_passphrase(&mnemonic, old_password, new_encryption_key)
                .context("Failed to encrypt mnemonic with new encryption key")?;

        MnemonicCiphertext {
            salt: new_salt,
            inner: ciphertext,
        }
    };

    Ok((new_mnemonic_ciphertext, new_xpub))
}

/// Decrypt `mnemonic_ciphertext` using `old_password` and re-encrypt using `new_password`.
pub fn change_wallet_encryption(
    mnemonic_ciphertext: &str,
    network: &str,
    old_password: &str,
    new_password: &str,
) -> Result<(MnemonicCiphertext, Xpub)> {
    let network = Network::from_str(network).context("Invalid network")?;

    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let old_encryption_key = derive_encryption_key(old_password, &mnemonic_ciphertext.salt)
        .context("Failed to generate old encryption key")?;

    let (mnemonic, old_passphrase) =
        decrypt_mnemonic(mnemonic_ciphertext.inner, old_encryption_key)
            .context("Failed to decrypt mnemonic using old encryption key")?;

    let new_xpub = {
        // The password is _not_ used as a passphrase to allow the user to change it without
        // changing the `Xpriv`.
        let seed = mnemonic.to_seed("");
        let xprv = Xpriv::new_master(network, &seed).context("Failed to derive new Xpriv")?;

        Xpub::from_priv(&Secp256k1::new(), &xprv)
    };

    let new_mnemonic_ciphertext = {
        let mut rng = thread_rng();
        let new_salt = rng.gen::<[u8; 32]>();

        let new_encryption_key = derive_encryption_key(new_password, &new_salt)
            .context("Failed to generate new encryption key")?;

        let ciphertext = match old_passphrase {
            Some(old_passphrase) => {
                encrypt_mnemonic_with_passphrase(&mnemonic, &old_passphrase, new_encryption_key)
                    .context("Failed to encrypt mnemonic with new encryption key")?
            }
            None => encrypt_mnemonic(&mnemonic, new_encryption_key)
                .context("Failed to encrypt mnemonic with new encryption key")?,
        };

        MnemonicCiphertext {
            salt: new_salt,
            inner: ciphertext,
        }
    };

    Ok((new_mnemonic_ciphertext, new_xpub))
}

/// Find the [`KeyPair`] corresponding to the given [`PublicKey`].
///
/// This builds on the assumption that the [`PublicKey`] was derived from the [`Wallet`]'s [`Xpub`].
///
/// Since version 0.4.0, all derived keys are non-hardened.
fn find_kp_for_pk(xprv: &Xpriv, network: NetworkKind, pk: &PublicKey) -> Result<Keypair> {
    // This is an arbitrary number. We may need to increase it in the future.
    let n = 100;
    for i in 0..n {
        log::info!("Looking for keypair matching public key {pk}; trying index {i}");
        let kp = get_normal_kp_for_network(xprv, i, network).context("No kp for index")?;

        if kp.public_key() == pk.inner {
            log::info!("Found keypair matching public key {pk} at index {i}");

            return Ok(kp);
        }
    }

    bail!("Could not find keypair for public key {pk} after {n} iterations");
}

fn generate_mnemonic<R>(rng: &mut R) -> Result<Mnemonic>
where
    R: Rng + CryptoRng,
{
    let mnemonic = Mnemonic::generate_in_with(rng, bip39::Language::English, 12)?;

    Ok(mnemonic)
}

impl Wallet {
    /// Create a [`Wallet`] using the provided `mnemonic`, `password` and `network`.
    ///
    /// The `password` is being used for two purposes to derive an encryption key with which to
    /// encrypt the `mnemonic`.
    fn new<R>(
        rng: &mut R,
        mnemonic: Mnemonic,
        password: &str,
        network: &str,
    ) -> Result<(Self, MnemonicCiphertext)>
    where
        R: Rng,
    {
        let network = Network::from_str(network).context("Invalid network")?;

        let salt = rng.gen::<[u8; 32]>();
        let encryption_key = derive_encryption_key(password, &salt)?;

        let xprv = {
            // The password is _not_ used as a passphrase to allow the user to change it without
            // changing the `Xpriv`.
            let seed = mnemonic.to_seed("");
            Xpriv::new_master(network, &seed)?
        };

        let mnemonic_ciphertext = {
            let ciphertext = encrypt_mnemonic(&mnemonic, encryption_key)?;

            MnemonicCiphertext {
                salt,
                inner: ciphertext,
            }
        };

        let wallet = Self {
            mnemonic,
            xprv,
            legacy_xprv: None,
            network,
        };

        Ok((wallet, mnemonic_ciphertext))
    }

    /// Reconstruct a [`Wallet`] from a [`MnemonicCiphertext`], a `password` and a [`Network`].
    fn from_ciphertext(
        mnemonic_ciphertext: MnemonicCiphertext,
        password: &str,
        network: &str,
    ) -> Result<Self> {
        let network = Network::from_str(network).context("Invalid network")?;

        let encryption_key = derive_encryption_key(password, &mnemonic_ciphertext.salt)?;

        let (mnemonic, old_passphrase) =
            decrypt_mnemonic(mnemonic_ciphertext.inner, encryption_key)?;

        let xprv = {
            // The password is _not_ used as a passphrase to allow the user to change it without
            // changing the `Xpriv`.
            let seed = mnemonic.to_seed("");
            Xpriv::new_master(network, &seed).context("Failed to derive Xpriv")?
        };

        // If the ciphertext includes an `old_passphrase` (a legacy artifact), it means that the
        // wallet was generated before the upgrade to users only having a single password.
        //
        // In that case, we generate the legacy `Xpriv`, so that the user can spend legacy
        // collateral outputs too.
        let legacy_xprv = old_passphrase
            .map(|old_passphrase| {
                let seed = mnemonic.to_seed(old_passphrase);
                let xprv = Xpriv::new_master(network, &seed)?;

                anyhow::Ok(xprv)
            })
            .transpose()
            .context("Failed to derive legacy Xpriv")?;

        Ok(Self {
            mnemonic,
            xprv,
            legacy_xprv,
            network,
        })
    }

    fn mnemonic(&self) -> &Mnemonic {
        &self.mnemonic
    }

    fn nsec(&self) -> Result<SecretKey> {
        let nsec = derive_nsec_from_xprv(&self.xprv)?;
        Ok(nsec)
    }
}

impl MnemonicCiphertext {
    /// Serialize a [`MnemonicCiphertext`] for storage.
    pub fn serialize(&self) -> String {
        format!("{}${}", hex::encode(self.salt), hex::encode(&self.inner))
    }

    fn from_str(serialized: &str) -> Result<Self> {
        let mut parts = serialized.split('$');

        let salt = parts.next().context("no salt in ciphertext")?;
        let mnemonic = parts.next().context("no mnemonic in ciphertext")?;

        let mut salt_buffer = [0u8; 32];
        hex::decode_to_slice(salt, &mut salt_buffer)?;

        let mnemonic_ciphertext = hex::decode(mnemonic)?;

        Ok(Self {
            salt: salt_buffer,
            inner: mnemonic_ciphertext,
        })
    }
}

fn derive_encryption_key(password: &str, salt: &[u8]) -> Result<[u8; 32]> {
    let h = Hkdf::<Sha256>::new(Some(salt), password.as_bytes());
    let mut enc_key = [0u8; 32];
    h.expand(b"ENCRYPTION_KEY", &mut enc_key)
        .context("failed to derive encryption key")?;

    Ok(enc_key)
}

/// Encrypt the mnemonic seed phrase with the encryption key.
///
/// # Choice of nonce
///
/// We store the mnemonic seed phrase on disk and, as such, have to use a constant nonce. Otherwise,
/// we would not be able to decrypt it again. The encryption only happens once and, as such, there
/// is conceptually only one message and we are not "reusing" the nonce which would be insecure.
fn encrypt_mnemonic(mnemonic: &Mnemonic, encryption_key: [u8; 32]) -> Result<Vec<u8>> {
    let mnemonic = mnemonic.to_string();
    let plaintext = mnemonic.as_bytes();

    let key = aes_gcm_siv::Key::<Aes256GcmSiv>::from_slice(&encryption_key);
    let cipher = Aes256GcmSiv::new(key);

    let ciphertext = cipher
        .encrypt(
            aes_gcm_siv::Nonce::from_slice(SECRET_KEY_ENCRYPTION_NONCE),
            plaintext,
        )
        .context("failed to encrypt mnemonic")?;

    Ok(ciphertext)
}

// TODO: use index
fn derive_nsec_from_xprv(xprv: &Xpriv) -> Result<SecretKey> {
    let path = DerivationPath::from_str(NSEC_DERIVATION_PATH).expect("to be valid");

    let secp = Secp256k1::new();

    // Derive the child key at the specified path
    let child_xprv = xprv.derive_priv(&secp, &path)?;

    // Get the private key bytes
    let private_key_bytes = child_xprv.private_key.secret_bytes();

    // Create SecretKey from bytes
    let secret_key = SecretKey::from_slice(&private_key_bytes)?;

    Ok(secret_key)
}

/// Encrypt the mnemonic seed phrase with the encryption key plus a passphrase.
///
/// Old wallets used to have a passphrase. New ones do not. We keep the passphrase around in the
/// ciphertext to maintain backwards-compatibility.
///
/// # Choice of nonce
///
/// We store the mnemonic seed phrase on disk and, as such, have to use a constant nonce. Otherwise,
/// we would not be able to decrypt it again. The encryption only happens once and, as such, there
/// is conceptually only one message and we are not "reusing" the nonce which would be insecure.
fn encrypt_mnemonic_with_passphrase(
    mnemonic: &Mnemonic,
    old_passphrase: &str,
    encryption_key: [u8; 32],
) -> Result<Vec<u8>> {
    let mnemonic = mnemonic.to_string();
    let mnemonic_and_passphrase = [mnemonic, " ".to_string(), old_passphrase.to_string()].concat();
    let plaintext = mnemonic_and_passphrase.as_bytes();

    let key = aes_gcm_siv::Key::<Aes256GcmSiv>::from_slice(&encryption_key);
    let cipher = Aes256GcmSiv::new(key);

    let ciphertext = cipher
        .encrypt(
            aes_gcm_siv::Nonce::from_slice(SECRET_KEY_ENCRYPTION_NONCE),
            plaintext,
        )
        .context("failed to encrypt mnemonic")?;

    Ok(ciphertext)
}

/// Decrypt the mnemonic ciphertext with the encryption key.
fn decrypt_mnemonic(
    mnemonic_ciphertext: Vec<u8>,
    encryption_key: [u8; 32],
) -> Result<(Mnemonic, Option<String>)> {
    let key = aes_gcm_siv::Key::<Aes256GcmSiv>::from_slice(&encryption_key);
    let cipher = Aes256GcmSiv::new(key);

    let plaintext = cipher
        .decrypt(
            aes_gcm_siv::Nonce::from_slice(SECRET_KEY_ENCRYPTION_NONCE),
            mnemonic_ciphertext.as_slice(),
        )
        .context("failed to decrypt mnemonic")?;

    let mut mnemonic = String::from_utf8(plaintext)?;

    let cloned_mnemonic = mnemonic.clone();
    let words = cloned_mnemonic.split_whitespace().collect::<Vec<_>>();

    // Since the upgrade to users only having a single password, upgraded wallets will include the
    // `old_passphrase` in the `mnemonic_ciphertext`. This is because we used to derive the `Xpriv`
    // using the `mnemonic` and the `old_passphrase`.
    let old_passphrase = if words.len() >= 13 {
        mnemonic = words[..12].join(" ");
        Some(words[12].to_owned())
    } else {
        None
    };

    let mnemonic = Mnemonic::from_str(&mnemonic)?;

    Ok((mnemonic, old_passphrase))
}

/// Returns a nsec derived from the wallet Xprv in byte format
pub(crate) fn get_nsec() -> Result<String> {
    let guard = WALLET.lock().expect("to get lock");

    let nsec = match *guard {
        Some(ref wallet) => wallet.nsec()?,
        None => {
            bail!("Can't get nsec if wallet is not loaded");
        }
    };

    Ok(nsec.secret_bytes().to_hex_string(Case::Lower))
}

/// Returns a pubkey derived from a [`contract`] in hex format
pub(crate) fn contract_to_pubkey(contract: String) -> Result<String> {
    let mut hasher = Sha256::new();
    hasher.update(contract.as_bytes());
    let hash = hasher.finalize();

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&hash)?;

    let public_key = secret_key.public_key(&secp);

    let (public_key, _) = public_key.x_only_public_key();
    Ok(public_key.to_string())
}

/// Returns a npub derived from a [`XPub`] in hex format
pub(crate) fn derive_npub(xpub: String) -> Result<String> {
    let xpub = Xpub::from_str(xpub.as_str()).context("Invalid xpub provided")?;

    let path = DerivationPath::from_str(NSEC_DERIVATION_PATH).expect("to be valid");

    let secp = Secp256k1::new();

    // Derive the child key at the specified path
    let child_xprv = xpub.derive_pub(&secp, &path)?;

    let public_key = child_xprv.public_key;

    let (public_key, _) = public_key.x_only_public_key();
    Ok(public_key.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_mnemonic_roundtrip() {
        let mut rng = thread_rng();
        let mnemonic = Mnemonic::generate_in_with(&mut rng, bip39::Language::English, 12).unwrap();

        let encryption_key = rng.gen::<[u8; 32]>();

        let mnemonic_ciphertext = encrypt_mnemonic(&mnemonic, encryption_key).unwrap();

        let (mnemonic_decrypted, old_passphrase) =
            decrypt_mnemonic(mnemonic_ciphertext, encryption_key).unwrap();

        assert_eq!(mnemonic_decrypted, mnemonic);
        assert!(old_passphrase.is_none())
    }

    #[test]
    fn encrypt_mnemonic_with_passphrase_roundtrip() {
        let mut rng = thread_rng();
        let mnemonic = Mnemonic::generate_in_with(&mut rng, bip39::Language::English, 12).unwrap();

        let encryption_key = rng.gen::<[u8; 32]>();

        let old_passphrase = "foo".to_string();
        let mnemonic_ciphertext =
            encrypt_mnemonic_with_passphrase(&mnemonic, &old_passphrase, encryption_key).unwrap();

        let (mnemonic_decrypted, old_passphrase_decrypted) =
            decrypt_mnemonic(mnemonic_ciphertext, encryption_key).unwrap();

        assert_eq!(mnemonic_decrypted, mnemonic);
        assert_eq!(old_passphrase_decrypted, Some(old_passphrase))
    }
}
