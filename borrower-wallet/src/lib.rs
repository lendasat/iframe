use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

mod browser_wallet;
mod storage;

// We make it public for the "e2e" tests.
pub mod wallet;

#[wasm_bindgen]
pub fn new_wallet(passphrase: String, network: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::new(passphrase, network))
}

#[wasm_bindgen]
pub fn load_wallet(passphrase: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::load(&passphrase))
}

#[wasm_bindgen]
pub fn is_wallet_loaded() -> Result<bool, JsValue> {
    map_err_to_js!(wallet::is_wallet_loaded())
}

#[wasm_bindgen]
pub fn does_wallet_exist() -> Result<bool, JsValue> {
    map_err_to_js!(browser_wallet::does_wallet_exist())
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
    pk: String,
) -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::sign_claim_psbt(
        &psbt,
        &collateral_descriptor,
        &pk
    ))
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
