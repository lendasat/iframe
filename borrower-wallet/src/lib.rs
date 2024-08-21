use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

mod browser_wallet;
mod storage;

// We make it public for the "e2e" tests.
pub mod wallet;

#[wasm_bindgen]
pub fn new_wallet(passphrase: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::new(passphrase))
}

#[wasm_bindgen]
pub fn load_wallet(passphrase: String) -> Result<(), JsValue> {
    map_err_to_js!(browser_wallet::load(&passphrase))
}

#[wasm_bindgen]
pub fn get_mnemonic() -> Result<String, JsValue> {
    map_err_to_js!(wallet::get_mnemonic())
}

#[wasm_bindgen]
pub fn get_next_pk() -> Result<String, JsValue> {
    map_err_to_js!(browser_wallet::get_next_pk())
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
