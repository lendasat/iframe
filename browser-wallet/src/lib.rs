use bitcoin::hex::Case;
use bitcoin::hex::DisplayHex;
use bitcoin::Address;
use client_sdk::auth::Salt;
use client_sdk::auth::ServerProof;
use client_sdk::auth::B;
use client_sdk::wallet::NOSTR_DERIVATION_PATH;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

mod auth;
mod browser_wallet;
mod storage;
mod wallet;

#[wasm_bindgen]
pub struct WalletDetails {
    mnemonic_ciphertext: String,
    network: String,
}

#[wasm_bindgen]
impl WalletDetails {
    #[wasm_bindgen(getter)]
    pub fn mnemonic_ciphertext(&self) -> String {
        self.mnemonic_ciphertext.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn network(&self) -> String {
        self.network.clone()
    }
}

impl From<browser_wallet::WalletDetails> for WalletDetails {
    fn from(value: browser_wallet::WalletDetails) -> Self {
        WalletDetails {
            mnemonic_ciphertext: value.mnemonic_ciphertext,
            network: value.network,
        }
    }
}

#[wasm_bindgen(start)]
pub fn initialize() {
    console_log::init_with_level(log::Level::Debug).expect("error initializing log");
    log::info!("Logger initialized!");
}

#[wasm_bindgen]
pub fn new_wallet(password: String, network: String) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(browser_wallet::new(password, network).map(WalletDetails::from))
}

#[wasm_bindgen]
pub fn persist_new_wallet(
    mnemonic_ciphertext: String,
    network: String,
    key: String,
) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::persist_new_wallet(
        mnemonic_ciphertext,
        network,
        key
    ))
}

#[wasm_bindgen]
pub fn new_wallet_from_mnemonic(
    password: String,
    mnemonic: String,
    network: String,
    key: String,
) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(
        browser_wallet::new_from_mnemonic(password, mnemonic, network, key)
            .map(WalletDetails::from)
    )
}

#[wasm_bindgen]
pub fn restore_wallet(
    key: String,
    mnemonic_ciphertext: String,
    network: String,
) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::restore(key, mnemonic_ciphertext, network))
}

#[wasm_bindgen]
pub fn upgrade_wallet(
    key: String,
    mnemonic_ciphertext: String,
    network: String,
    old_password: String,
    new_password: String,
    contract_pks: Vec<String>,
    is_borrower: bool,
) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(browser_wallet::upgrade_wallet(
        key,
        mnemonic_ciphertext,
        network,
        old_password,
        new_password,
        contract_pks,
        is_borrower
    )
    .map(WalletDetails::from))
}

#[wasm_bindgen]
pub fn change_wallet_encryption(
    key: String,
    old_password: String,
    new_password: String,
) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(
        browser_wallet::change_wallet_encryption(key, old_password, new_password)
            .map(WalletDetails::from)
    )
}

#[wasm_bindgen]
pub fn load_wallet(password: String, key: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::load(&password, &key))
}

#[wasm_bindgen]
pub fn is_wallet_loaded() -> Result<bool, JsValue> {
    map_err_to_js!(wallet::is_wallet_loaded())
}

#[wasm_bindgen]
pub fn does_wallet_exist(key: String) -> Result<bool, JsValue> {
    map_err_to_js!(browser_wallet::does_wallet_exist(&key))
}

#[wasm_bindgen]
pub fn is_wallet_equal(
    key: String,
    mnemonic_ciphertext: String,
    network: String,
) -> Result<bool, JsValue> {
    map_err_to_js!(browser_wallet::is_wallet_equal(
        &key,
        &mnemonic_ciphertext,
        &network,
    ))
}

#[wasm_bindgen]
pub fn get_mnemonic() -> Result<String, JsValue> {
    map_err_to_js!(wallet::get_mnemonic())
}

#[wasm_bindgen]
pub fn unlock_and_sign_claim_psbt(
    password: String,
    key: String,
    psbt: String,
    collateral_descriptor: String,
    own_pk: String,
    derivation_path: Option<String>,
) -> Result<SignedTransaction, JsValue> {
    if let Err(err) = browser_wallet::load(&password, &key) {
        log::error!("Failed unlocking wallet {err:#}");
        return Err(JsValue::from_str(&format!("{err:#}")));
    }

    let (tx, outputs, params) = map_err_to_js!(browser_wallet::sign_claim_psbt(
        &psbt,
        &collateral_descriptor,
        &own_pk,
        derivation_path.as_deref(),
    ))?;

    let outputs = map_err_to_js!(outputs
        .into_iter()
        .map(|o| {
            Ok(TxOut {
                value: o.value.to_sat(),
                address: Address::from_script(&o.script_pubkey, &params)?.to_string(),
            })
        })
        .collect::<anyhow::Result<Vec<_>>>())?;

    Ok(SignedTransaction { tx, outputs })
}

#[wasm_bindgen]
pub fn sign_claim_psbt(
    psbt: String,
    collateral_descriptor: String,
    own_pk: String,
    derivation_path: Option<String>,
) -> Result<SignedTransaction, JsValue> {
    let (tx, outputs, params) = map_err_to_js!(browser_wallet::sign_claim_psbt(
        &psbt,
        &collateral_descriptor,
        &own_pk,
        derivation_path.as_deref(),
    ))?;

    let outputs = map_err_to_js!(outputs
        .into_iter()
        .map(|o| {
            Ok(TxOut {
                value: o.value.to_sat(),
                address: Address::from_script(&o.script_pubkey, &params)?.to_string(),
            })
        })
        .collect::<anyhow::Result<Vec<_>>>())?;

    Ok(SignedTransaction { tx, outputs })
}

#[wasm_bindgen]
pub fn sign_liquidation_psbt(
    psbt: String,
    collateral_descriptor: String,
    own_pk: String,
    derivation_path: Option<String>,
) -> Result<SignedTransaction, JsValue> {
    let (tx, outputs, params) = map_err_to_js!(browser_wallet::sign_liquidation_psbt(
        &psbt,
        &collateral_descriptor,
        &own_pk,
        derivation_path.as_deref(),
    ))?;

    let outputs = map_err_to_js!(outputs
        .into_iter()
        .map(|o| {
            Ok(TxOut {
                value: o.value.to_sat(),
                address: Address::from_script(&o.script_pubkey, &params)?.to_string(),
            })
        })
        .collect::<anyhow::Result<Vec<_>>>())?;

    Ok(SignedTransaction { tx, outputs })
}

#[wasm_bindgen]
pub fn sign_liquidation_psbt_with_password(
    password: String,
    key: String,
    psbt: String,
    collateral_descriptor: String,
    own_pk: String,
    derivation_path: Option<String>,
) -> Result<SignedTransaction, JsValue> {
    if let Err(err) = browser_wallet::load(&password, &key) {
        log::error!("Failed unlocking wallet {err:#}");
        return Err(JsValue::from_str(&format!("{err:#}")));
    }

    let (tx, outputs, params) = map_err_to_js!(browser_wallet::sign_liquidation_psbt(
        &psbt,
        &collateral_descriptor,
        &own_pk,
        derivation_path.as_deref(),
    ))?;

    let outputs = map_err_to_js!(outputs
        .into_iter()
        .map(|o| {
            Ok(TxOut {
                value: o.value.to_sat(),
                address: Address::from_script(&o.script_pubkey, &params)?.to_string(),
            })
        })
        .collect::<anyhow::Result<Vec<_>>>())?;

    Ok(SignedTransaction { tx, outputs })
}

#[wasm_bindgen]
pub fn get_nsec(key: String) -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::get_nsec(key))
}

#[wasm_bindgen]
pub fn get_npub(key: String) -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::get_npub(key))
}

#[wasm_bindgen]
pub fn get_nostr_derivation_path() -> String {
    NOSTR_DERIVATION_PATH.to_string()
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone)]
pub struct PkAndPath {
    pub pubkey: String,
    pub path: String,
}

#[wasm_bindgen]
pub fn get_pk_and_derivation_path(key: String) -> Result<PkAndPath, JsValue> {
    map_err_to_js!(
        browser_wallet::get_next_normal_pk(key).map(|(pk, path)| PkAndPath {
            pubkey: pk.to_string(),
            path: path.to_string()
        })
    )
}

#[wasm_bindgen]
pub fn derive_nostr_room_pk(contract: String) -> Result<String, JsValue> {
    map_err_to_js!(client_sdk::wallet::derive_nostr_room_pk(contract))
}

#[wasm_bindgen]
pub struct SignedTransaction {
    tx: String,
    outputs: Vec<TxOut>,
}

#[wasm_bindgen]
impl SignedTransaction {
    #[wasm_bindgen(getter)]
    pub fn tx(&self) -> String {
        self.tx.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn outputs(&self) -> Vec<TxOut> {
        self.outputs.clone()
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct TxOut {
    pub value: u64,
    address: String,
}

#[wasm_bindgen]
impl TxOut {
    #[wasm_bindgen(getter)]
    pub fn address(&self) -> String {
        self.address.clone()
    }
}

#[wasm_bindgen]
pub fn begin_registration(username: String, password: String) -> RegistrationData {
    let (verifier, salt) = auth::begin_registration(username, password);

    RegistrationData {
        verifier: verifier.to_hex(),
        salt: salt.to_hex(),
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct RegistrationData {
    verifier: String,
    salt: String,
}

#[wasm_bindgen]
impl RegistrationData {
    #[wasm_bindgen(getter)]
    pub fn verifier(&self) -> String {
        self.verifier.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn salt(&self) -> String {
        self.salt.clone()
    }
}

#[wasm_bindgen]
pub fn process_login_response(
    username: String,
    password: String,
    salt: String,
    b_pub: String,
) -> Result<VerificationData, JsValue> {
    let salt = map_err_to_js!(Salt::try_from_hex(salt))?;
    let b_pub = map_err_to_js!(B::try_from_hex(b_pub))?;

    let (a_pub, client_proof) = map_err_to_js!(auth::process_login_response(
        username, password, salt, b_pub
    ))?;

    Ok(VerificationData {
        a_pub: a_pub.to_hex(),
        client_proof: client_proof.to_hex(),
    })
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct VerificationData {
    a_pub: String,
    client_proof: String,
}

#[wasm_bindgen]
impl VerificationData {
    #[wasm_bindgen(getter)]
    pub fn a_pub(&self) -> String {
        self.a_pub.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn client_proof(&self) -> String {
        self.client_proof.clone()
    }
}

#[wasm_bindgen]
pub fn verify_server(server_proof: String) -> Result<bool, JsValue> {
    let server_proof = map_err_to_js!(ServerProof::try_from_hex(server_proof))?;

    let res = auth::verify_server(server_proof);

    Ok(res.is_ok())
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone)]
pub struct FiatLoanDetails {
    pub inner: InnerFiatLoanDetails,
    pub encrypted_encryption_key_own: String,
    pub encrypted_encryption_key_counterparty: String,
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone)]
pub struct InnerFiatLoanDetails {
    pub iban_transfer_details: Option<IbanTransferDetails>,
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
    pub comments: Option<String>,
}

#[wasm_bindgen]
impl InnerFiatLoanDetails {
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn new(
        iban_transfer_details: Option<IbanTransferDetails>,
        swift_transfer_details: Option<SwiftTransferDetails>,
        bank_name: String,
        bank_address: String,
        bank_country: String,
        purpose_of_remittance: String,
        full_name: String,
        address: String,
        city: String,
        post_code: String,
        country: String,
        comments: Option<String>,
    ) -> Self {
        Self {
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
        }
    }
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone)]
pub struct IbanTransferDetails {
    pub iban: String,
    pub bic: Option<String>,
}

#[wasm_bindgen]
impl IbanTransferDetails {
    #[wasm_bindgen(constructor)]
    pub fn new(iban: String, bic: Option<String>) -> Self {
        Self { iban, bic }
    }
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone)]
pub struct SwiftTransferDetails {
    pub bic_or_swift: String,
    pub account_number: String,
}

#[wasm_bindgen]
impl SwiftTransferDetails {
    #[wasm_bindgen(constructor)]
    pub fn new(bic_or_swift: String, account_number: String) -> Self {
        Self {
            bic_or_swift,
            account_number,
        }
    }
}

#[wasm_bindgen]
pub fn encrypt_fiat_loan_details(
    fiat_loan_details: InnerFiatLoanDetails,
    own_encryption_pk: String,
    counterparty_encryption_pk: String,
) -> Result<FiatLoanDetails, JsValue> {
    let (fiat_loan_details, encrypted_encryption_key_own, encrypted_encryption_key_counterparty) =
        map_err_to_js!(client_sdk::wallet::encrypt_fiat_loan_details(
            &fiat_loan_details.into(),
            &own_encryption_pk,
            &counterparty_encryption_pk
        ))?;

    Ok(FiatLoanDetails {
        inner: fiat_loan_details.into(),
        encrypted_encryption_key_own,
        encrypted_encryption_key_counterparty,
    })
}

#[wasm_bindgen]
pub fn decrypt_fiat_loan_details_with_password(
    password: String,
    key: String,
    fiat_loan_details: InnerFiatLoanDetails,
    encrypted_encryption_key: String,
    derivation_path: String,
) -> Result<InnerFiatLoanDetails, JsValue> {
    if let Err(err) = browser_wallet::load(&password, &key) {
        log::error!("Failed decrypting details {err:#}");
        return Err(JsValue::from_str(&format!("{err:#}")));
    }

    let fiat_loan_details = map_err_to_js!(wallet::decrypt_fiat_loan_details(
        &fiat_loan_details.into(),
        &encrypted_encryption_key,
        &derivation_path
    ))?;

    Ok(fiat_loan_details.into())
}

impl From<InnerFiatLoanDetails> for client_sdk::wallet::FiatLoanDetails {
    fn from(value: InnerFiatLoanDetails) -> Self {
        Self {
            iban_transfer_details: value.iban_transfer_details.map(|i| {
                client_sdk::wallet::IbanTransferDetails {
                    iban: i.iban,
                    bic: i.bic,
                }
            }),
            swift_transfer_details: value.swift_transfer_details.map(|s| {
                client_sdk::wallet::SwiftTransferDetails {
                    swift_or_bic: s.bic_or_swift,
                    account_number: s.account_number,
                }
            }),
            bank_name: value.bank_name,
            bank_address: value.bank_address,
            bank_country: value.bank_country,
            purpose_of_remittance: value.purpose_of_remittance,
            full_name: value.full_name,
            address: value.address,
            city: value.city,
            post_code: value.post_code,
            country: value.country,
            comments: value.comments,
        }
    }
}

impl From<client_sdk::wallet::FiatLoanDetails> for InnerFiatLoanDetails {
    fn from(value: client_sdk::wallet::FiatLoanDetails) -> Self {
        Self {
            iban_transfer_details: value.iban_transfer_details.map(|i| IbanTransferDetails {
                iban: i.iban,
                bic: i.bic,
            }),
            swift_transfer_details: value.swift_transfer_details.map(|s| SwiftTransferDetails {
                bic_or_swift: s.swift_or_bic,
                account_number: s.account_number,
            }),
            bank_name: value.bank_name,
            bank_address: value.bank_address,
            bank_country: value.bank_country,
            purpose_of_remittance: value.purpose_of_remittance,
            full_name: value.full_name,
            address: value.address,
            city: value.city,
            post_code: value.post_code,
            country: value.country,
            comments: value.comments,
        }
    }
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone)]
pub struct Version {
    pub version: String,
    pub commit_hash: String,
    pub build_timestamp: u64,
}

#[wasm_bindgen]
pub fn get_version() -> Version {
    let commit_hash = option_env!("GIT_COMMIT_HASH")
        .unwrap_or("unknown")
        .to_string();
    let version = option_env!("GIT_TAG").unwrap_or("unknown").to_string();
    let build_timestamp = env!("BUILD_TIMESTAMP").parse::<u64>().unwrap_or(0);

    Version {
        version,
        commit_hash,
        build_timestamp,
    }
}

#[wasm_bindgen]
pub fn get_next_address(key: String) -> Result<String, JsValue> {
    let address = map_err_to_js!(browser_wallet::get_next_address(key))?;

    Ok(address.to_string())
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone)]
pub struct SignedMessage {
    pub message: String,
    pub recoverable_signature_hex: String,
    pub recoverable_signature_id: i32,
}

#[wasm_bindgen]
pub fn sign_message_with_pk(
    message: String,
    own_pk: String,
    derivation_path: Option<String>,
) -> Result<SignedMessage, JsValue> {
    let signed_message = map_err_to_js!(wallet::sign_message(
        message.as_str(),
        own_pk.as_str(),
        derivation_path.as_deref()
    ))?;

    let (id, bytes) = signed_message.signature.serialize_compact();
    let recoverable_signature_hex = bytes.to_hex_string(Case::Lower);
    let recoverable_signature_id = id.to_i32();

    Ok(SignedMessage {
        message: signed_message.message.to_string(),
        recoverable_signature_hex,
        recoverable_signature_id,
    })
}

#[wasm_bindgen]
pub fn sign_message_with_pk_and_password(
    password: String,
    key: String,
    message: String,
    own_pk: String,
    derivation_path: Option<String>,
) -> Result<SignedMessage, JsValue> {
    if let Err(err) = browser_wallet::load(&password, &key) {
        log::error!("Failed unlocking wallet {err:#}");
        return Err(JsValue::from_str(&format!("{err:#}")));
    }

    let signed_message = map_err_to_js!(wallet::sign_message(
        message.as_str(),
        own_pk.as_str(),
        derivation_path.as_deref()
    ))?;

    let (id, bytes) = signed_message.signature.serialize_compact();
    let recoverable_signature_hex = bytes.to_hex_string(Case::Lower);
    let recoverable_signature_id = id.to_i32();

    Ok(SignedMessage {
        message: signed_message.message.to_string(),
        recoverable_signature_hex,
        recoverable_signature_id,
    })
}

#[macro_export]
macro_rules! map_err_to_js {
    ($e:expr) => {
        match $e {
            Ok(i) => Ok(i),
            Err(e) => Err(JsValue::from_str(&format!("{:#}", e))),
        }
    };
}
