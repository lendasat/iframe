use aes_gcm_siv::aead::Aead;
use aes_gcm_siv::Aes256GcmSiv;
use aes_gcm_siv::KeyInit;
use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use bitcoin::bip32::DerivationPath;
use bitcoin::bip32::Xpriv;
use bitcoin::key::Secp256k1;
use bitcoin::secp256k1;
use bitcoin::PublicKey;
use hkdf::Hkdf;
use rand::thread_rng;
use rand::Rng;
use sha2::Sha256;

/// It is safe to reuse this nonce because we use AES-CGM-SIV.
const NONCE: &[u8; 12] = b"6by2d6wxps3a";

/// Details needed for the lender to send fiat to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, PartialEq)]
pub struct FiatLoanDetails {
    /// Details for transfers within Europe (generally).
    pub iban_transfer_details: Option<IbanTransferDetails>,
    /// Details for transfers outside Europe (generally).
    pub swift_transfer_details: Option<SwiftTransferDetails>,
    pub bank_name: String,
    pub bank_address: String,
    pub bank_country: String,
    pub purpose_of_remittance: String,
    pub full_name: String,
    pub address: String,
    pub city: String,
    pub post_code: String,
    pub country: String,
    /// Extra information the borrower may want to provide to the lender.
    pub comments: Option<String>,
}

/// Details needed for the lender to send fiat via an IBAN transfer to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, PartialEq)]
pub struct IbanTransferDetails {
    pub iban: String,
    pub bic: Option<String>,
}

/// Details needed for the lender to send fiat via a SWIFT transfer to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, PartialEq)]
pub struct SwiftTransferDetails {
    pub swift_or_bic: String,
    pub account_number: String,
}

/// Symmetrically encrypt [`FiatLoanDetails`] with a randomly generated encryption key.
///
/// The encryption key is itself encrypted against an own public key and a counterparty public key.
/// The two encrypted encryption keys can then be stored in the hub database, since the hub will not
/// be able to decrypt them.
///
/// # Returns
///
/// - An instance of [`FiatLoanDetails`] with encrypted values in each field.
/// - The encrypted encryption key for the caller.
/// - The encrypted encryption key for the counterparty.
pub fn encrypt_fiat_loan_details(
    fiat_loan_details: &FiatLoanDetails,
    own_pk: &PublicKey,
    counterparty_pk: &PublicKey,
) -> Result<(FiatLoanDetails, String, String)> {
    let mut rng = thread_rng();

    let encryption_key = rng.gen::<[u8; 32]>();

    let nonce = aes_gcm_siv::Nonce::from_slice(NONCE);

    let FiatLoanDetails {
        iban_transfer_details,
        swift_transfer_details,
        bank_name,
        bank_address,
        bank_country,
        purpose_of_remittance,
        full_name,
        address,
        city,
        post_code,
        country,
        comments,
    } = fiat_loan_details;

    let (iban, bic) = match iban_transfer_details {
        Some(iban_transfer_details) => (
            Some(
                encrypt_field(
                    &encryption_key,
                    nonce,
                    iban_transfer_details.iban.as_bytes(),
                )
                .context("failed to encrypt iban")?,
            ),
            match &iban_transfer_details.bic {
                None => None,
                Some(bic) => Some(
                    encrypt_field(&encryption_key, nonce, bic.as_bytes())
                        .context("failed to encrypt bic")?,
                ),
            },
        ),
        None => (None, None),
    };

    let swift_transfer_details = match swift_transfer_details {
        Some(swift_transfer_details) => Some((
            encrypt_field(
                &encryption_key,
                nonce,
                swift_transfer_details.swift_or_bic.as_bytes(),
            )
            .context("failed to encrypt swift_or_bic")?,
            encrypt_field(
                &encryption_key,
                nonce,
                swift_transfer_details.account_number.as_bytes(),
            )
            .context("failed to encrypt iban_or_account_number")?,
        )),
        None => None,
    };

    let bank_name = encrypt_field(&encryption_key, nonce, bank_name.as_bytes())
        .context("failed to encrypt bank_name")?;
    let bank_address = encrypt_field(&encryption_key, nonce, bank_address.as_bytes())
        .context("failed to encrypt bank_address")?;
    let bank_country = encrypt_field(&encryption_key, nonce, bank_country.as_bytes())
        .context("failed to encrypt bank_country")?;
    let purpose_of_remittance =
        encrypt_field(&encryption_key, nonce, purpose_of_remittance.as_bytes())
            .context("failed to encrypt purpose_of_remittance")?;
    let full_name = encrypt_field(&encryption_key, nonce, full_name.as_bytes())
        .context("failed to encrypt full_name")?;
    let address = encrypt_field(&encryption_key, nonce, address.as_bytes())
        .context("failed to encrypt address")?;
    let city =
        encrypt_field(&encryption_key, nonce, city.as_bytes()).context("failed to encrypt city")?;
    let post_code = encrypt_field(&encryption_key, nonce, post_code.as_bytes())
        .context("failed to encrypt post_code")?;
    let country = encrypt_field(&encryption_key, nonce, country.as_bytes())
        .context("failed to encrypt country")?;

    let comments = match comments {
        Some(comments) => Some(
            encrypt_field(&encryption_key, nonce, comments.as_bytes())
                .context("failed to encrypt comments")?,
        ),
        None => None,
    };

    let fiat_loan_details = FiatLoanDetails {
        iban_transfer_details: iban.map(|iban| IbanTransferDetails { iban, bic }),
        swift_transfer_details: swift_transfer_details.map(
            |(swift_or_bic, iban_or_account_number)| SwiftTransferDetails {
                swift_or_bic,
                account_number: iban_or_account_number,
            },
        ),
        bank_name,
        bank_address,
        bank_country,
        purpose_of_remittance,
        full_name,
        address,
        city,
        post_code,
        country,
        comments,
    };

    let encrypted_encryption_key_own =
        ecies::encrypt(&own_pk.inner.serialize(), &encryption_key)
            .map_err(|e| anyhow!("failed to encrypt encryption key for caller: {e:?}"))?;
    let encrypted_encryption_key_own = hex::encode(encrypted_encryption_key_own);

    let encrypted_encryption_key_counterparty =
        ecies::encrypt(&counterparty_pk.inner.serialize(), &encryption_key)
            .map_err(|e| anyhow!("failed to encrypt encryption key for counterparty: {e:?}"))?;
    let encrypted_encryption_key_counterparty = hex::encode(encrypted_encryption_key_counterparty);

    Ok((
        fiat_loan_details,
        encrypted_encryption_key_own,
        encrypted_encryption_key_counterparty,
    ))
}

/// Decrypt [`FiatLoanDetails`].
///
/// First we decrypt the `encrypted_encryption_key` using a secret key derived from the `own_xpriv`
/// with [`DERIVATION_PATH`]. This produces the encryption key with which to decrypt all the fields
/// in [`FiatLoanDetails`].
///
/// # Returns
///
/// An instance of [`FiatLoanDetails`] with plaintext values in each field.
pub fn decrypt_fiat_loan_details(
    fiat_loan_details: &FiatLoanDetails,
    encrypted_encryption_key: &str,
    own_xpriv: &Xpriv,
    derivation_path: &DerivationPath,
) -> Result<FiatLoanDetails> {
    let encrypted_encryption_key = hex::decode(encrypted_encryption_key)?;

    let own_sk = own_encryption_sk(own_xpriv, derivation_path)?;

    let encryption_key_vec = ecies::decrypt(&own_sk.secret_bytes(), &encrypted_encryption_key)
        .map_err(|e| anyhow!("failed to decrypt encryption key: {e:?}"))?;

    let mut encryption_key = [0u8; 32];
    encryption_key.copy_from_slice(&encryption_key_vec);

    let nonce = aes_gcm_siv::Nonce::from_slice(NONCE);

    let FiatLoanDetails {
        iban_transfer_details,
        swift_transfer_details,
        bank_name,
        bank_address,
        bank_country,
        purpose_of_remittance,
        full_name,
        address,
        city,
        post_code,
        country,
        comments,
    } = fiat_loan_details;

    let (iban, bic) = match iban_transfer_details {
        Some(iban_transfer_details) => (
            Some(decrypt_field(
                &encryption_key,
                nonce,
                &iban_transfer_details.iban,
            )?),
            match &iban_transfer_details.bic {
                None => None,
                Some(bic) => Some(decrypt_field(&encryption_key, nonce, bic)?),
            },
        ),
        None => (None, None),
    };

    let swift_transfer_details = match swift_transfer_details {
        Some(swift_transfer_details) => Some((
            decrypt_field(&encryption_key, nonce, &swift_transfer_details.swift_or_bic)?,
            decrypt_field(
                &encryption_key,
                nonce,
                &swift_transfer_details.account_number,
            )?,
        )),
        None => None,
    };

    let bank_name = decrypt_field(&encryption_key, nonce, bank_name)?;
    let bank_address = decrypt_field(&encryption_key, nonce, bank_address)?;
    let bank_country = decrypt_field(&encryption_key, nonce, bank_country)?;
    let purpose_of_remittance = decrypt_field(&encryption_key, nonce, purpose_of_remittance)?;
    let full_name = decrypt_field(&encryption_key, nonce, full_name)?;
    let address = decrypt_field(&encryption_key, nonce, address)?;
    let city = decrypt_field(&encryption_key, nonce, city)?;
    let post_code = decrypt_field(&encryption_key, nonce, post_code)?;
    let country = decrypt_field(&encryption_key, nonce, country)?;

    let comments = match comments {
        Some(comments) => Some(decrypt_field(&encryption_key, nonce, comments)?),
        None => None,
    };

    let fiat_loan_details = FiatLoanDetails {
        iban_transfer_details: iban.map(|iban| IbanTransferDetails { iban, bic }),
        swift_transfer_details: swift_transfer_details.map(
            |(swift_or_bic, iban_or_account_number)| SwiftTransferDetails {
                swift_or_bic,
                account_number: iban_or_account_number,
            },
        ),
        bank_name,
        bank_address,
        bank_country,
        purpose_of_remittance,
        full_name,
        address,
        city,
        post_code,
        country,
        comments,
    };

    Ok(fiat_loan_details)
}

fn own_encryption_sk(own_xpriv: &Xpriv, path: &DerivationPath) -> Result<secp256k1::SecretKey> {
    let secp = Secp256k1::new();

    let own_sk = own_xpriv.derive_priv(&secp, &path)?;

    Ok(own_sk.private_key)
}

fn derive_encryption_key(secret: &[u8; 32], salt: &[u8]) -> Result<[u8; 32]> {
    let h = Hkdf::<Sha256>::new(Some(salt), secret);
    let mut enc_key = [0u8; 32];
    h.expand(b"ENCRYPTION_KEY", &mut enc_key)
        .context("failed to derive encryption key")?;

    Ok(enc_key)
}

fn encrypt_field(
    original_encryption_key: &[u8; 32],
    nonce: &aes_gcm_siv::Nonce,
    field: &[u8],
) -> Result<String> {
    let mut rng = thread_rng();

    let salt = rng.gen::<[u8; 32]>();

    let encryption_key = derive_encryption_key(original_encryption_key, &salt)?;
    let encryption_key = aes_gcm_siv::Key::<Aes256GcmSiv>::from_slice(&encryption_key);
    let cipher = Aes256GcmSiv::new(encryption_key);

    let field = cipher
        .encrypt(nonce, field)
        .context("failed to encrypt field")?;

    let ciphertext = format!("{}${}", hex::encode(salt), hex::encode(field));

    Ok(ciphertext)
}

fn decrypt_field(
    original_encryption_key: &[u8; 32],
    nonce: &aes_gcm_siv::Nonce,
    field: &str,
) -> Result<String> {
    let mut parts = field.split('$');

    let salt_str = parts.next().context("no salt in ciphertext")?;
    let field_str = parts.next().context("no field in ciphertext")?;

    let mut salt = [0u8; 32];
    hex::decode_to_slice(salt_str, &mut salt)?;

    let field_ciphertext = hex::decode(field_str)?;

    let encryption_key = derive_encryption_key(original_encryption_key, &salt)?;
    let encryption_key = aes_gcm_siv::Key::<Aes256GcmSiv>::from_slice(&encryption_key);
    let cipher = Aes256GcmSiv::new(encryption_key);

    let plaintext = cipher.decrypt(nonce, field_ciphertext.as_slice())?;
    let field = String::from_utf8(plaintext)?;

    Ok(field)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bitcoin::Network;

    #[test]
    fn roundtrip() {
        let fiat_loan_details = FiatLoanDetails {
            iban_transfer_details: Some(IbanTransferDetails {
                iban: "NL87ABNA4193835510".to_string(),
                bic: None,
            }),
            swift_transfer_details: None,
            bank_name: "Bank".to_string(),
            bank_address: "Street 1".to_string(),
            bank_country: "Netherlands".to_string(),
            purpose_of_remittance: "Food".to_string(),
            full_name: "Mr Bitcoin".to_string(),
            address: "Street 2".to_string(),
            city: "Amsterdam".to_string(),
            post_code: "1000".to_string(),
            country: "Netherlands".to_string(),
            comments: Some("Heya".to_string()),
        };

        let secp = Secp256k1::new();

        let borrower_path = "m/10/10/1".parse().expect("to be valid");

        let borrower_xpriv = Xpriv::new_master(Network::Regtest, &[0u8; 64]).unwrap();
        let borrower_sk = borrower_xpriv.derive_priv(&secp, &borrower_path).unwrap();
        let borrower_pk = secp256k1::PublicKey::from_secret_key(&secp, &borrower_sk.private_key);
        let borrower_pk = PublicKey::new(borrower_pk);

        let lender_path = "m/10/10/2".parse().expect("to be valid");

        let lender_xpriv = Xpriv::new_master(Network::Regtest, &[1u8; 64]).unwrap();
        let lender_sk = lender_xpriv.derive_priv(&secp, &lender_path).unwrap();
        let lender_pk = secp256k1::PublicKey::from_secret_key(&secp, &lender_sk.private_key);
        let lender_pk = PublicKey::new(lender_pk);

        let (
            encrypted_fiat_loan_details,
            encrypted_encryption_key_borrower,
            encrypted_encryption_key_lender,
        ) = encrypt_fiat_loan_details(&fiat_loan_details, &borrower_pk, &lender_pk).unwrap();

        let decrypted_fiat_loan_details_borrower = decrypt_fiat_loan_details(
            &encrypted_fiat_loan_details,
            &encrypted_encryption_key_borrower,
            &borrower_xpriv,
            &borrower_path,
        )
        .unwrap();

        assert_eq!(decrypted_fiat_loan_details_borrower, fiat_loan_details);

        let decrypted_fiat_loan_details_lender = decrypt_fiat_loan_details(
            &encrypted_fiat_loan_details,
            &encrypted_encryption_key_lender,
            &lender_xpriv,
            &lender_path,
        )
        .unwrap();

        assert_eq!(decrypted_fiat_loan_details_lender, fiat_loan_details);
    }
}
