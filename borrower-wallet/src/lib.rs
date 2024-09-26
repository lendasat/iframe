use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

mod browser_wallet;
mod storage;

// We make it public for the "e2e" tests.
pub mod wallet;

#[wasm_bindgen]
pub fn new_wallet(passphrase: String, network: String, username: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::new(passphrase, network, username))
}

#[wasm_bindgen]
pub fn load_wallet(passphrase: String, username: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::load(&passphrase, &username))
}

#[wasm_bindgen]
pub fn is_wallet_loaded() -> Result<bool, JsValue> {
    map_err_to_js!(wallet::is_wallet_loaded())
}

#[wasm_bindgen]
pub fn does_wallet_exist(username: String) -> Result<bool, JsValue> {
    map_err_to_js!(browser_wallet::does_wallet_exist(&username))
}

#[wasm_bindgen]
pub fn get_mnemonic() -> Result<String, JsValue> {
    map_err_to_js!(wallet::get_mnemonic())
}

#[wasm_bindgen]
pub fn get_next_pk(username: String) -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::get_next_pk(&username))
}

#[wasm_bindgen]
pub fn sign_claim_psbt(
    psbt: String,
    collateral_descriptor: String,
    pk: String,
    username: String,
) -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::sign_claim_psbt(
        &psbt,
        &collateral_descriptor,
        &pk,
        &username
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
