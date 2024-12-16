use bitcoin::Address;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

mod browser_wallet;
mod storage;

// We make it public for the "e2e" tests.
pub mod wallet;

#[wasm_bindgen]
pub struct WalletDetails {
    passphrase_hash: String,
    mnemonic_ciphertext: String,
    network: String,
    xpub: String,
}

#[wasm_bindgen]
impl WalletDetails {
    #[wasm_bindgen(getter)]
    pub fn passphrase_hash(&self) -> String {
        self.passphrase_hash.clone()
    }
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
            passphrase_hash: value.passphrase_hash,
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
    passphrase: String,
    network: String,
    key: String,
) -> Result<WalletDetails, JsValue> {
    map_err_to_js!(browser_wallet::new(passphrase, network, key).map(WalletDetails::from))
}

#[wasm_bindgen]
pub fn restore_wallet(
    key: String,
    passphrase_hash: String,
    mnemonic_ciphertext: String,
    xpub: String,
    network: String,
) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::restore(
        key,
        passphrase_hash,
        mnemonic_ciphertext,
        network,
        xpub
    ))
}

#[wasm_bindgen]
pub fn load_wallet(passphrase: String, key: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::load(&passphrase, &key))
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
pub fn get_next_pk() -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::get_next_pk())
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

#[macro_export]
macro_rules! map_err_to_js {
    ($e:expr) => {
        match $e {
            Ok(i) => Ok(i),
            Err(e) => Err(JsValue::from_str(&format!("{:#}", e))),
        }
    };
}
