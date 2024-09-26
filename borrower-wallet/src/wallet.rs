use aes_gcm_siv::aead::Aead;
use aes_gcm_siv::Aes256GcmSiv;
use aes_gcm_siv::KeyInit;
use anyhow::anyhow;
use anyhow::bail;
use anyhow::ensure;
use anyhow::Context;
use anyhow::Result;
use argon2::password_hash::PasswordHashString;
use argon2::password_hash::SaltString;
use argon2::Argon2;
use argon2::PasswordHash;
use argon2::PasswordHasher;
use argon2::PasswordVerifier;
use bip39::Mnemonic;
use bitcoin::bip32::ChildNumber;
use bitcoin::bip32::Xpriv;
use bitcoin::key::Keypair;
use bitcoin::key::Secp256k1;
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
use sha2::Sha256;
use std::str::FromStr;
use std::sync::LazyLock;
use std::sync::Mutex;
use std::sync::MutexGuard;

const SECRET_KEY_ENCRYPTION_NONCE: &[u8; 12] = b"SECRET_KEY!!";

static WALLET: LazyLock<Mutex<Option<Wallet>>> = LazyLock::new(|| Mutex::new(None));

struct Wallet {
    /// We keep this so that we can display it to the user.
    mnemonic: Mnemonic,
    xprv: Xpriv,
    network: Network,
}

pub struct MnemonicCiphertext {
    salt: [u8; 32],
    inner: Vec<u8>,
}

pub fn new_wallet(
    passphrase: &str,
    network: &str,
) -> Result<(PasswordHashString, MnemonicCiphertext, Network)> {
    let mut guard = WALLET.lock().expect("to get lock");

    ensure!(guard.is_none(), "Wallet already loaded");

    let mut rng = thread_rng();

    let mnemonic = generate_mnemonic(&mut rng)?;

    let (wallet, mnemonic_ciphertext) = Wallet::new(&mut rng, mnemonic, passphrase, network)?;
    let network = wallet.network;

    let passphrase_hash = hash_passphrase(&mut rng, passphrase)?;

    guard.replace(wallet);

    Ok((passphrase_hash, mnemonic_ciphertext, network))
}

pub fn load_wallet(
    passphrase: &str,
    passphrase_hash: &str,
    mnemonic_ciphertext: &str,
    network: &str,
) -> Result<()> {
    let mut guard = WALLET.lock().expect("to get lock");

    ensure!(guard.is_none(), "Wallet already loaded");

    let passphrase_hash = PasswordHash::new(passphrase_hash).map_err(|error| anyhow!(error))?;

    Argon2::default()
        .verify_password(passphrase.as_bytes(), &passphrase_hash)
        .map_err(|error| anyhow!(error))?;

    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let wallet = Wallet::from_ciphertext(mnemonic_ciphertext, passphrase, network)?;

    guard.replace(wallet);

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

pub fn get_pk(index: u32) -> Result<PublicKey> {
    let guard = WALLET.lock().expect("to get lock");

    let kp = get_kp(guard, index)?;
    let pk = PublicKey::new(kp.public_key());

    Ok(pk)
}

fn get_kp(guard: MutexGuard<Option<Wallet>>, index: u32) -> Result<Keypair> {
    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Can't get keypair if wallet is not loaded");
        }
    };

    let network_index = if wallet.xprv.network.is_mainnet() {
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

    let sk = wallet
        .xprv
        .derive_priv(&Secp256k1::new(), &path)?
        .private_key;

    let kp = Keypair::from_secret_key(&Secp256k1::new(), &sk);

    Ok(kp)
}

pub fn sign_claim_psbt(
    mut psbt: Psbt,
    collateral_descriptor: Descriptor<PublicKey>,
    index: u32,
) -> Result<Transaction> {
    let guard = WALLET.lock().expect("to get lock");

    let kp = get_kp(guard, index).context("No kp for index")?;
    let sk = kp.secret_key();
    let pk = PublicKey::new(kp.public_key());

    let collateral_amount = psbt.inputs[0]
        .clone()
        .witness_utxo
        .context("No witness UTXO")?
        .value;

    let sighash = SighashCache::new(&psbt.unsigned_tx)
        .p2wsh_signature_hash(
            0,
            &collateral_descriptor
                .script_code()
                .context("No script code")?,
            collateral_amount,
            EcdsaSighashType::All,
        )
        .context("Can't produce sighash cache")?;

    let secp = Secp256k1::new();

    let sig = secp.sign_ecdsa(&sighash.into(), &sk);

    psbt.inputs[0].partial_sigs.insert(
        pk,
        bitcoin::ecdsa::Signature {
            signature: sig,
            sighash_type: EcdsaSighashType::All,
        },
    );

    let psbt = psbt
        .finalize(&secp)
        .map_err(|e| anyhow!("Failed to finalize PSBT: {e:?}"))?;

    let tx = psbt.extract(&secp).context("Could not extract signed TX")?;

    Ok(tx)
}

fn generate_mnemonic<R>(rng: &mut R) -> Result<Mnemonic>
where
    R: Rng + CryptoRng,
{
    let mnemonic = Mnemonic::generate_in_with(rng, bip39::Language::English, 12)?;

    Ok(mnemonic)
}

#[allow(clippy::print_stdout)]
fn hash_passphrase<R>(rng: &mut R, passphrase: &str) -> Result<PasswordHashString>
where
    R: Rng + CryptoRng,
{
    let salt = SaltString::generate(rng);

    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(passphrase.as_bytes(), &salt)
        .map_err(|error| anyhow!(error))?;

    Ok(password_hash.into())
}

impl Wallet {
    /// Create a [`Wallet`] using the provided `mnemonic` and `passphrase`.
    fn new<R>(
        rng: &mut R,
        mnemonic: Mnemonic,
        passphrase: &str,
        network: &str,
    ) -> Result<(Self, MnemonicCiphertext)>
    where
        R: Rng,
    {
        let network = Network::from_str(network).context("Invalid network")?;

        let salt = rng.gen::<[u8; 32]>();
        let encryption_key = derive_encryption_key(passphrase, &salt)?;

        let xprv = {
            let seed = mnemonic.to_seed(passphrase);
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
            network,
        };

        Ok((wallet, mnemonic_ciphertext))
    }

    /// Create a [`Wallet`] from a [`MnemonicCiphertext`], a `passphrase` and a [`Network`].
    fn from_ciphertext(
        mnemonic_ciphertext: MnemonicCiphertext,
        passphrase: &str,
        network: &str,
    ) -> Result<Self> {
        let network = Network::from_str(network).context("Invalid network")?;

        let encryption_key = derive_encryption_key(passphrase, &mnemonic_ciphertext.salt)?;

        let mnemonic = decrypt_mnemonic(mnemonic_ciphertext.inner, encryption_key)?;

        let xprv = {
            let seed = mnemonic.to_seed(passphrase);
            Xpriv::new_master(NetworkKind::Test, &seed)?
        };

        Ok(Self {
            mnemonic,
            xprv,
            network,
        })
    }

    fn mnemonic(&self) -> &Mnemonic {
        &self.mnemonic
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

/// Decrypt the mnemonic ciphertext with the encryption key.
fn decrypt_mnemonic(mnemonic_ciphertext: Vec<u8>, encryption_key: [u8; 32]) -> Result<Mnemonic> {
    let key = aes_gcm_siv::Key::<Aes256GcmSiv>::from_slice(&encryption_key);
    let cipher = Aes256GcmSiv::new(key);

    let plaintext = cipher
        .decrypt(
            aes_gcm_siv::Nonce::from_slice(SECRET_KEY_ENCRYPTION_NONCE),
            mnemonic_ciphertext.as_slice(),
        )
        .context("failed to decrypt mnemonic")?;

    let mnemonic = String::from_utf8(plaintext)?;
    let mnemonic = Mnemonic::from_str(&mnemonic)?;

    Ok(mnemonic)
}
