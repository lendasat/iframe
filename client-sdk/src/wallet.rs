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
use bitcoin::hashes::sha256d;
use bitcoin::hashes::Hash;
use bitcoin::key::Keypair;
use bitcoin::key::Secp256k1;
use bitcoin::secp256k1::ecdsa::RecoverableSignature;
use bitcoin::secp256k1::Message;
use bitcoin::secp256k1::SecretKey;
use bitcoin::sighash::SighashCache;
use bitcoin::sign_message::signed_msg_hash;
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
use std::str::FromStr as _;

mod fiat_loan_details;

pub use fiat_loan_details::FiatLoanDetails;
pub use fiat_loan_details::IbanTransferDetails;
pub use fiat_loan_details::SwiftTransferDetails;

pub const NOSTR_DERIVATION_PATH: &str = "m/44/0/0/0/0";

const SECRET_KEY_ENCRYPTION_NONCE: &[u8; 12] = b"SECRET_KEY!!";

pub struct Wallet {
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
    /// This determines the next public key to be derived.
    ///
    /// Since a user can have the same wallet in multiple devices, we do not attempt to synchronize
    /// across all devices. PK reuse is acceptable.
    contract_index: u32,
}
#[derive(Clone)]
pub struct MnemonicCiphertext {
    salt: [u8; 32],
    inner: Vec<u8>,
}

pub struct SignedMessage {
    pub message: sha256d::Hash,
    pub signature: RecoverableSignature,
}

impl Wallet {
    /// Create a [`Wallet`] with a random [`Mnemonic`], using the provided `password`, [`network`]
    /// and `contract_index`.
    pub fn random<R>(
        rng: &mut R,
        password: &str,
        network: &str,
        contract_index: u32,
    ) -> Result<(Self, MnemonicCiphertext)>
    where
        R: Rng + CryptoRng,
    {
        let mnemonic = Mnemonic::generate_in_with(rng, bip39::Language::English, 12)?;

        Self::new(rng, mnemonic, password, network, contract_index)
    }

    /// Create a [`Wallet`] using the provided [`Mnemonic`], `password`, [`network`] and
    /// `contract_index`.
    pub fn new<R>(
        rng: &mut R,
        mnemonic: Mnemonic,
        password: &str,
        network: &str,
        contract_index: u32,
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
            contract_index,
        };

        Ok((wallet, mnemonic_ciphertext))
    }

    /// Reconstruct a [`Wallet`] from a [`MnemonicCiphertext`], a `password` and a [`Network`].
    pub fn from_ciphertext(
        mnemonic_ciphertext: MnemonicCiphertext,
        password: &str,
        network: &str,
        contract_index: u32,
    ) -> Result<Self> {
        let network = Network::from_str(network).context("Invalid network")?;

        let encryption_key = derive_encryption_key(password, &mnemonic_ciphertext.salt)?;

        let (mnemonic, old_passphrase) = decrypt_mnemonic(&mnemonic_ciphertext, encryption_key)?;

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
            contract_index,
        })
    }

    /// Derive the next [`PublicKey`], usually for a new collateral contract.
    ///
    /// The [`DerivationPath`] is returned so that the caller can provide it later to sign with the
    /// corresponding [`KeyPair`].
    pub fn next_hardened_pk(&mut self) -> Result<(PublicKey, DerivationPath)> {
        let contract_index = self.contract_index;

        self.contract_index += 1;

        // This can be serialised as `m/10101'/0'/i'`, where i is based on the wallet's contract
        // index.
        let path = vec![
            ChildNumber::from_hardened_idx(10101).expect("infallible"),
            ChildNumber::from_hardened_idx(0).expect("infallible"),
            ChildNumber::from_hardened_idx(contract_index).expect("infallible"),
        ];
        let path = DerivationPath::from(path);

        let kp = get_kp_from_path(&self.xprv, &path)?;

        Ok((kp.public_key().into(), path))
    }

    /// Sign a [`Psbt`] spending a collateral contract in which our own [`PublicKey`] was involved.
    ///
    /// The [`DerivationPath`] is used as a hint in order to find the corresponding [`KeyPair`]
    /// which will be used to sign the transaction. If the [`DerivationPath`] is missing or we can't
    /// find the correct [`PublicKey`] using it, we fall back on old heuristics.
    pub fn sign_spend_collateral_psbt(
        &self,
        mut psbt: Psbt,
        collateral_descriptor: Descriptor<PublicKey>,
        own_pk: PublicKey,
        derivation_path: Option<&DerivationPath>,
    ) -> Result<Transaction> {
        let kp = self.find_kp(derivation_path, &own_pk)?;
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

    /// Signs a message using Bitcoin's message signing format.
    ///
    /// The message will be prefixed with b"\x18Bitcoin Signed Message:\n" before signing. See
    /// https://docs.rs/satsnet/latest/src/satsnet/sign_message.rs.html#201-208.
    pub fn sign_message(
        &self,
        message: &str,
        own_pk: PublicKey,
        derivation_path: Option<&DerivationPath>,
    ) -> Result<SignedMessage> {
        let kp = self.find_kp(derivation_path, &own_pk)?;
        let sk = kp.secret_key();

        let secp = Secp256k1::new();
        let msg_hash = signed_msg_hash(message);
        let msg = Message::from_digest(msg_hash.to_byte_array());
        let secp_sig = secp.sign_ecdsa_recoverable(&msg, &sk);

        Ok(SignedMessage {
            message: msg_hash,
            signature: secp_sig,
        })
    }

    fn find_kp(
        &self,
        // Newer contracts use a derivation path decided by the Lendasat server.
        //
        // Older contracts used a local index, unknown to the Lendasat server and not backed up. To
        // find the corresponding secret key, we use a heuristic: we look through the first 100
        // keys using the common derivation path `586/0/*` (for mainnet) until we find one
        // that matches our public key in the contract i.e. `own_pk`.
        derivation_path: Option<&DerivationPath>,
        own_pk: &PublicKey,
    ) -> Result<Keypair> {
        let kp = match derivation_path {
            // We use the caller's suggested derivation path.
            Some(derivation_path) => {
                log::debug!(
                    "Looking for KP matching PK {own_pk}, using derivation path {derivation_path}"
                );

                let kp = get_kp_from_path(&self.xprv, derivation_path)
                    .context("Failed to get KP from path")?;
                let xpub = Xpub::from_priv(&Secp256k1::new(), &self.xprv);

                log::debug!(
                    "Derived PK {} with derivation path {derivation_path} for Xpub {xpub}",
                    kp.public_key(),
                );

                if kp.public_key() == own_pk.inner {
                    kp
                } else {
                    log::debug!("Derived PK from Xpub does not match target {own_pk}");

                    match self.legacy_xprv {
                        Some(legacy_xprv) => {
                            log::debug!(
                                "Looking for KP matching PK {own_pk}, \
                             using derivation path {derivation_path} and legacy Xpriv"
                            );

                            let kp = get_kp_from_path(&legacy_xprv, derivation_path)
                                .context("Failed to get KP from path")?;

                            let legacy_xpub = Xpub::from_priv(&Secp256k1::new(), &legacy_xprv);

                            log::debug!(
                                "Derived PK {} with derivation path {derivation_path} \
                            for legacy Xpub {legacy_xpub}",
                                kp.public_key(),
                            );

                            if kp.public_key() != own_pk.inner {
                                // We use a keypair derived from the legacy Xprv.
                                kp
                            } else {
                                log::debug!(
                                    "Derived PK from legacy Xpub \
                                does not match target {own_pk}"
                                );

                                // We fall back on our heuristic in case the derivation path was
                                // incorrect.
                                self.find_kp_using_heuristic(own_pk)
                                    .context("Failed to find KP using heuristic")?
                            }
                        }
                        None => {
                            // We fall back on our heuristic in case the derivation path was
                            // incorrect.
                            self.find_kp_using_heuristic(own_pk)
                                .context("Failed to find KP using heuristic")?
                        }
                    }
                }
            }
            None => self
                .find_kp_using_heuristic(own_pk)
                .context("Failed to find KP using heuristic")?,
        };

        log::info!("KP found for PK {own_pk}");

        Ok(kp)
    }

    fn find_kp_using_heuristic(&self, own_pk: &PublicKey) -> Result<Keypair> {
        log::debug!("Looking for KP matching PK {own_pk}, without known derivation path");

        let network = self.network.into();
        let res = find_kp_for_pk(&self.xprv, network, own_pk)
            .context("Could not find keypair with regular Xpriv");

        let kp = match res {
            Ok(kp) => kp,
            Err(e) => {
                if let Some(legacy_xprv) = self.legacy_xprv {
                    log::warn!("Falling back to legacy Xpriv: {e}");

                    find_kp_for_borrower_pk_legacy(&legacy_xprv, own_pk)
                        .context("Could not find keypair to sign using legacy Xpriv")?
                } else {
                    bail!(e);
                }
            }
        };

        Ok(kp)
    }

    pub fn decrypt_fiat_loan_details(
        &self,
        fiat_loan_details: &FiatLoanDetails,
        encrypted_encryption_key: &str,
        derivation_path: &DerivationPath,
    ) -> Result<FiatLoanDetails> {
        fiat_loan_details::decrypt_fiat_loan_details(
            fiat_loan_details,
            encrypted_encryption_key,
            &self.xprv,
            derivation_path,
        )
    }

    pub fn mnemonic(&self) -> &Mnemonic {
        &self.mnemonic
    }

    pub fn nsec(&self) -> Result<SecretKey> {
        let xprv: &Xpriv = &self.xprv;
        let path = DerivationPath::from_str(NOSTR_DERIVATION_PATH).expect("to be valid");

        let secp = Secp256k1::new();

        // Derive the child key at the specified path
        let child_xprv = xprv.derive_priv(&secp, &path)?;

        // Get the private key bytes
        let private_key_bytes = child_xprv.private_key.secret_bytes();

        // Create SecretKey from bytes
        let secret_key = SecretKey::from_slice(&private_key_bytes)?;

        Ok(secret_key)
    }

    pub fn npub(&self) -> Result<nostr::key::PublicKey> {
        let nsec = self.nsec()?;
        let public_key = nsec.public_key(&Secp256k1::new());

        let npub =
            nostr::key::PublicKey::from_slice(&public_key.x_only_public_key().0.serialize())?;

        Ok(npub)
    }

    pub fn xpub(&self) -> Xpub {
        Xpub::from_priv(&Secp256k1::new(), &self.xprv)
    }

    pub fn network(&self) -> Network {
        self.network
    }
}

fn get_normal_pk_for_network_and_index(xpub: &str, network: &str, index: u32) -> Result<PublicKey> {
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

    let path = vec![
        ChildNumber::from_hardened_idx(586).expect("infallible"),
        network_index,
        ChildNumber::from_hardened_idx(index).expect("infallible"),
    ];

    get_kp_from_path(legacy_xprv, &DerivationPath::from(path))
}

fn get_normal_kp_for_network(xprv: &Xpriv, index: u32, network: NetworkKind) -> Result<Keypair> {
    let network_index = if network.is_mainnet() {
        ChildNumber::from_normal_idx(0).expect("infallible")
    } else {
        ChildNumber::from_normal_idx(1).expect("infallible")
    };

    let path = vec![
        ChildNumber::from_normal_idx(586).expect("infallible"),
        network_index,
        ChildNumber::from_normal_idx(index).expect("infallible"),
    ];

    get_kp_from_path(xprv, &DerivationPath::from(path))
}

fn get_kp_from_path(xprv: &Xpriv, derivation_path: &DerivationPath) -> Result<Keypair> {
    let sk = xprv
        .derive_priv(&Secp256k1::new(), derivation_path)?
        .private_key;
    let kp = Keypair::from_secret_key(&Secp256k1::new(), &sk);

    Ok(kp)
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

/// Find the keypair for a given public key using legacy derivation.
///
/// This function searches for a keypair by trying different derivation paths
/// and network types. It's used for backward compatibility with older wallets.
///
/// # Arguments
///
/// * `legacy_xprv` - The legacy extended private key
/// * `pk` - The public key to find the corresponding private key for
///
/// # Returns
///
/// The keypair if found.
///
/// # Errors
///
/// Returns an error if the keypair cannot be found after exhaustive search.
pub fn find_kp_for_borrower_pk_legacy(legacy_xprv: &Xpriv, pk: &PublicKey) -> Result<Keypair> {
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
pub fn does_pk_belong_to_xpub(xpub: &Xpub, target_pk: &PublicKey, network: Network) -> Result<()> {
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

/// Decrypt `mnemonic_ciphertext` using `old_password` and re-encrypt using `new_password`.
pub fn change_wallet_encryption(
    mnemonic_ciphertext: &str,
    old_password: &str,
    new_password: &str,
) -> Result<MnemonicCiphertext> {
    let mnemonic_ciphertext = MnemonicCiphertext::from_str(mnemonic_ciphertext)
        .context("Failed to deserialize mnemonic ciphertext")?;

    let old_encryption_key = derive_encryption_key(old_password, &mnemonic_ciphertext.salt)
        .context("Failed to generate old encryption key")?;

    let (mnemonic, old_passphrase) = decrypt_mnemonic(&mnemonic_ciphertext, old_encryption_key)
        .context("Failed to decrypt mnemonic using old encryption key")?;

    let new_mnemonic_ciphertext = {
        let mut rng = thread_rng();
        let new_salt = rng.gen::<[u8; 32]>();

        let new_encryption_key = derive_encryption_key(new_password, &mnemonic_ciphertext.salt)
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

    Ok(new_mnemonic_ciphertext)
}

pub fn is_signed_by_pk(
    msg_hash: sha256d::Hash,
    pk: &PublicKey,
    signature: &RecoverableSignature,
) -> Result<bool> {
    let secp = Secp256k1::new();

    let msg = Message::from_digest(msg_hash.to_byte_array());

    let pubkey = secp.recover_ecdsa(&msg, signature)?;

    let public_key = pk.inner;
    Ok(public_key == pubkey)
}

pub fn derive_next_normal_pk_multisig(
    xpub: Xpub,
    contract_index: u32,
) -> Result<(PublicKey, DerivationPath)> {
    derive_next_normal_pk(xpub, 0, contract_index)
}

pub fn derive_next_normal_pk_singlesig(
    xpub: Xpub,
    contract_index: u32,
) -> Result<(PublicKey, DerivationPath)> {
    derive_next_normal_pk(xpub, 1, contract_index)
}

fn derive_next_normal_pk(
    xpub: Xpub,
    // The purpose of the derived key is determined by this value. At the time of writing, `0` is
    // used for multisig addresses (loan collateral) and 1 for singlesig addresses (payouts).
    purpose: u32,
    contract_index: u32,
) -> Result<(PublicKey, DerivationPath)> {
    // This can be serialised as `m/10101/0/i`, where i is based on the wallet's contract
    // index.
    let path = vec![
        ChildNumber::from_normal_idx(10101).expect("infallible"),
        ChildNumber::from_normal_idx(purpose).expect("infallible"),
        ChildNumber::from_normal_idx(contract_index).expect("infallible"),
    ];
    let path = DerivationPath::from(path);

    let pk = xpub.derive_pub(&Secp256k1::new(), &path)?;

    Ok((pk.public_key.into(), path))
}

impl MnemonicCiphertext {
    pub fn new(salt: [u8; 32], inner: Vec<u8>) -> Self {
        Self { salt, inner }
    }

    /// Serialize a [`MnemonicCiphertext`] for storage.
    pub fn serialize(&self) -> String {
        format!("{}${}", hex::encode(self.salt), hex::encode(&self.inner))
    }

    pub fn salt(&self) -> [u8; 32] {
        self.salt
    }

    pub fn inner(&self) -> &[u8] {
        &self.inner
    }
}

impl std::str::FromStr for MnemonicCiphertext {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        let mut parts = s.split('$');

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

pub fn derive_encryption_key(password: &str, salt: &[u8]) -> Result<[u8; 32]> {
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
pub fn encrypt_mnemonic_with_passphrase(
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
pub fn decrypt_mnemonic(
    mnemonic_ciphertext: &MnemonicCiphertext,
    encryption_key: [u8; 32],
) -> Result<(Mnemonic, Option<String>)> {
    let key = aes_gcm_siv::Key::<Aes256GcmSiv>::from_slice(&encryption_key);
    let cipher = Aes256GcmSiv::new(key);

    let plaintext = cipher
        .decrypt(
            aes_gcm_siv::Nonce::from_slice(SECRET_KEY_ENCRYPTION_NONCE),
            mnemonic_ciphertext.inner.as_slice(),
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

/// Returns a pubkey derived from a [`contract`] in hex format
pub fn derive_nostr_room_pk(contract: String) -> Result<String> {
    let mut hasher = Sha256::new();
    hasher.update(contract.as_bytes());
    let hash = hasher.finalize();

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&hash)?;

    let public_key = secret_key.public_key(&secp);

    let (public_key, _) = public_key.x_only_public_key();
    Ok(public_key.to_string())
}

/// Encrypt [`FiatLoanDetails`] so that they can be stored in the Lendasat server's database.
///
/// The caller can decrypt the details after decrypting the `encrypted_encryption_key_own` with
/// their [`SecretKey`].
///
/// The counterparty can decrypt the details after decrypting the
/// `encrypted_encryption_key_counterparty` with their [`SecretKey`].
///
/// # Returns
///
/// - An instance of [`FiatLoanDetails`] with encrypted values in each field.
/// - The encrypted encryption key for the caller.
/// - The encrypted encryption key for the counterparty.
pub fn encrypt_fiat_loan_details(
    fiat_loan_details: &FiatLoanDetails,
    own_encryption_pk: &str,
    counterparty_encryption_pk: &str,
) -> Result<(FiatLoanDetails, String, String)> {
    let own_encryption_pk = own_encryption_pk.parse()?;
    let counterparty_encryption_pk = counterparty_encryption_pk.parse()?;

    let (fiat_loan_details, encrypted_encryption_key_caller, encrypted_encryption_key_counterparty) =
        fiat_loan_details::encrypt_fiat_loan_details(
            fiat_loan_details,
            &own_encryption_pk,
            &counterparty_encryption_pk,
        )?;

    Ok((
        fiat_loan_details,
        encrypted_encryption_key_caller,
        encrypted_encryption_key_counterparty,
    ))
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
        let mnemonic_ciphertext = MnemonicCiphertext::new([0u8; 32], mnemonic_ciphertext);

        let (mnemonic_decrypted, old_passphrase) =
            decrypt_mnemonic(&mnemonic_ciphertext, encryption_key).unwrap();

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
        let mnemonic_ciphertext = MnemonicCiphertext::new([0u8; 32], mnemonic_ciphertext);

        let (mnemonic_decrypted, old_passphrase_decrypted) =
            decrypt_mnemonic(&mnemonic_ciphertext, encryption_key).unwrap();

        assert_eq!(mnemonic_decrypted, mnemonic);
        assert_eq!(old_passphrase_decrypted, Some(old_passphrase))
    }

    #[test]
    fn test_signature_roundtrip() {
        let mut rng = thread_rng();
        let mnemonic = Mnemonic::generate_in_with(&mut rng, bip39::Language::English, 12).unwrap();

        let (wallet, _) = Wallet::new(&mut rng, mnemonic, "", "bitcoin", 1).unwrap();

        let xpub = wallet.xpub();

        let contract_index = wallet.contract_index;

        let (pk, path) = derive_next_normal_pk_multisig(xpub, contract_index).unwrap();

        let signed_message = wallet.sign_message("hello world", pk, Some(&path)).unwrap();
        let (id, bytes) = signed_message.signature.serialize_compact();

        let recovered_signature = RecoverableSignature::from_compact(&bytes, id).unwrap();

        let is_signed = is_signed_by_pk(signed_message.message, &pk, &recovered_signature).unwrap();
        assert!(is_signed, "Message to be signed by pk")
    }

    #[test]
    fn test_signature_with_invalid_signature() {
        let mut rng = thread_rng();
        let mnemonic = Mnemonic::generate_in_with(&mut rng, bip39::Language::English, 12).unwrap();

        let (wallet, _) = Wallet::new(&mut rng, mnemonic, "", "bitcoin", 1).unwrap();

        let xpub = wallet.xpub();

        let contract_index = wallet.contract_index;

        let (pk, path) = derive_next_normal_pk_multisig(xpub, contract_index).unwrap();

        let signed_message = wallet.sign_message("hello world", pk, Some(&path)).unwrap();

        let different_msg_hash = signed_msg_hash("a different message from what was signed");

        let is_signed =
            is_signed_by_pk(different_msg_hash, &pk, &signed_message.signature).unwrap();
        assert!(!is_signed, "Message not to be signed by pk")
    }
}
