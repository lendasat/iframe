use aes_gcm_siv::aead::Aead;
use aes_gcm_siv::Aes256GcmSiv;
use aes_gcm_siv::KeyInit;
use anyhow::bail;
use anyhow::ensure;
use anyhow::Context;
use anyhow::Result;
use bip39::Mnemonic;
use bitcoin::bip32::ChildNumber;
use bitcoin::bip32::Xpriv;
use bitcoin::key::Secp256k1;
use bitcoin::NetworkKind;
use bitcoin::PublicKey;
use hkdf::Hkdf;
use rand::thread_rng;
use rand::CryptoRng;
use rand::Rng;
use scrypt::password_hash::PasswordHash;
use scrypt::password_hash::PasswordHashString;
use scrypt::password_hash::PasswordHasher;
use scrypt::password_hash::PasswordVerifier;
use scrypt::password_hash::SaltString;
use scrypt::Scrypt;
use sha2::Sha256;
use std::str::FromStr;
use std::sync::LazyLock;
use std::sync::Mutex;

const SECRET_KEY_ENCRYPTION_NONCE: &[u8; 12] = b"SECRET_KEY!!";

// TODO: Make this dynamic.
const NETWORK_KIND: NetworkKind = NetworkKind::Test;

static WALLET: LazyLock<Mutex<Option<Wallet>>> = LazyLock::new(|| Mutex::new(None));

struct Wallet {
    /// We keep this so that we can display it to the user.
    mnemonic: Mnemonic,
    xprv: Xpriv,
}

pub struct MnemonicCiphertext {
    salt: [u8; 32],
    inner: Vec<u8>,
}

pub fn new_wallet(passphrase: &str) -> Result<(PasswordHashString, MnemonicCiphertext)> {
    let mut guard = WALLET.lock().expect("to get lock");

    ensure!(guard.is_none(), "Wallet already loaded");

    let mut rng = thread_rng();

    let mnemonic = generate_mnemonic(&mut rng)?;

    let (wallet, mnemonic_ciphertext) = Wallet::new(&mut rng, mnemonic, passphrase)?;

    let passphrase_hash = hash_passphrase(&mut rng, passphrase)?;

    guard.replace(wallet);

    Ok((passphrase_hash, mnemonic_ciphertext))
}

pub fn load_wallet(
    passphrase: &str,
    passphrase_hash: &str,
    mnemonic_ciphertext: &str,
) -> Result<()> {
    let mut guard = WALLET.lock().expect("to get lock");

    ensure!(guard.is_none(), "Wallet already loaded");

    let passphrase_hash = PasswordHash::new(passphrase_hash)?;

    Scrypt
        .verify_password(passphrase.as_bytes(), &passphrase_hash)
        .context("Incorrect passphrase")?;

    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let wallet = Wallet::from_ciphertext(mnemonic_ciphertext, passphrase)?;

    guard.replace(wallet);

    Ok(())
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

    let wallet = match *guard {
        Some(ref wallet) => wallet,
        None => {
            bail!("Can't get next public key if wallet is not loaded");
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

    let kp = bitcoin::key::Keypair::from_secret_key(&Secp256k1::new(), &sk);
    let pk = PublicKey::new(kp.public_key());

    Ok(pk)
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
    let params = if cfg!(debug_assertions) {
        // Use weak parameters in debug mode, to speed things up.
        println!("Using extremely weak scrypt parameters for password hashing");
        scrypt::Params::new(1, 1, 1, 10)?
    } else {
        scrypt::Params::recommended()
    };
    let salt = SaltString::generate(rng);
    let password_hash =
        Scrypt.hash_password_customized(passphrase.as_bytes(), None, None, params, &salt)?;

    Ok(password_hash.into())
}

impl Wallet {
    /// Create a [`Wallet`] using the provided `mnemonic` and `passphrase`.
    fn new<R>(
        rng: &mut R,
        mnemonic: Mnemonic,
        passphrase: &str,
    ) -> Result<(Self, MnemonicCiphertext)>
    where
        R: Rng,
    {
        let salt = rng.gen::<[u8; 32]>();
        let encryption_key = derive_encryption_key(passphrase, &salt)?;

        let xprv = {
            let seed = mnemonic.to_seed(passphrase);
            Xpriv::new_master(NETWORK_KIND, &seed)?
        };

        let mnemonic_ciphertext = {
            let ciphertext = encrypt_mnemonic(&mnemonic, encryption_key)?;

            MnemonicCiphertext {
                salt,
                inner: ciphertext,
            }
        };

        let wallet = Self { mnemonic, xprv };

        Ok((wallet, mnemonic_ciphertext))
    }

    /// Create a [`Wallet`] from a [`MnemonicCiphertext`] and a `passphrase`.
    fn from_ciphertext(mnemonic_ciphertext: MnemonicCiphertext, passphrase: &str) -> Result<Self> {
        let encryption_key = derive_encryption_key(passphrase, &mnemonic_ciphertext.salt)?;

        let mnemonic = decrypt_mnemonic(mnemonic_ciphertext.inner, encryption_key)?;

        let xprv = {
            let seed = mnemonic.to_seed(passphrase);
            Xpriv::new_master(NetworkKind::Test, &seed)?
        };

        Ok(Self { mnemonic, xprv })
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
