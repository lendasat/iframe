use crate::auth::Salt;
use crate::auth::ServerProof;
use crate::auth::B;
use bitcoin::Address;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

mod browser_wallet;
mod storage;

// We make them public for the "e2e" tests.
pub mod auth;
pub mod wallet;

#[wasm_bindgen]
pub struct WalletDetails {
    mnemonic_ciphertext: String,
    network: String,
    xpub: String,
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
    #[wasm_bindgen(getter)]
    pub fn xpub(&self) -> String {
        self.xpub.clone()
    }
}

impl From<browser_wallet::WalletDetails> for WalletDetails {
    fn from(value: browser_wallet::WalletDetails) -> Self {
        WalletDetails {
            mnemonic_ciphertext: value.mnemonic_ciphertext,
            network: value.network,
            xpub: value.xpub,
        }
    }
}

#[wasm_bindgen(start)]
pub fn initialize() {
    console_log::init_with_level(log::Level::Debug).expect("error initializing log");
    log::info!("Logger initialized!");
}

#[wasm_bindgen]
pub fn new_wallet(
    password: String,
    network: String,
    key: String,
) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(browser_wallet::new(password, None, network, key).map(WalletDetails::from))
}

#[wasm_bindgen]
pub fn new_wallet_from_mnemonic(
    password: String,
    mnemonic: String,
    network: String,
    key: String,
) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(
        browser_wallet::new(password, Some(mnemonic), network, key).map(WalletDetails::from)
    )
}

#[wasm_bindgen]
pub fn restore_wallet(
    key: String,
    mnemonic_ciphertext: String,
    xpub: String,
    network: String,
) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::restore(
        key,
        mnemonic_ciphertext,
        network,
        xpub
    ))
}

#[wasm_bindgen]
pub fn upgrade_wallet(
    key: String,
    mnemonic_ciphertext: String,
    network: String,
    old_password: String,
    new_password: String,
) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(browser_wallet::upgrade_wallet(
        key,
        mnemonic_ciphertext,
        network,
        old_password,
        new_password
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
pub fn get_mnemonic() -> Result<String, JsValue> {
    map_err_to_js!(wallet::get_mnemonic())
}

#[wasm_bindgen]
pub fn get_next_pk(key: String) -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::get_next_pk(&key))
}

#[wasm_bindgen]
pub fn sign_claim_psbt(
    psbt: String,
    collateral_descriptor: String,
    own_pk: String,
) -> Result<SignedTransaction, JsValue> {
    let (tx, outputs, params) = map_err_to_js!(browser_wallet::sign_claim_psbt(
        &psbt,
        &collateral_descriptor,
        &own_pk
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
) -> Result<SignedTransaction, JsValue> {
    let (tx, outputs, params) = map_err_to_js!(browser_wallet::sign_liquidation_psbt(
        &psbt,
        &collateral_descriptor,
        &own_pk
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
pub fn get_xpub(key: String) -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::get_xpub(&key))
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

#[macro_export]
macro_rules! map_err_to_js {
    ($e:expr) => {
        match $e {
            Ok(i) => Ok(i),
            Err(e) => Err(JsValue::from_str(&format!("{:#}", e))),
        }
    };
}
