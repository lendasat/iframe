use anyhow::Result;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

mod storage;
mod wallet;

#[wasm_bindgen]
pub fn new_wallet(passphrase: String) -> Result<(), JsValue> {
    map_err_to_js!(wallet::new_wallet(&passphrase))
}

#[wasm_bindgen]
pub fn load_wallet(passphrase: String) -> Result<(), JsValue> {
    map_err_to_js!(wallet::load_wallet(&passphrase))
}

#[wasm_bindgen]
pub fn get_mnemonic() -> Result<String, JsValue> {
    map_err_to_js!(wallet::get_mnemonic())
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
