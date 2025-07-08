use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use std::error::Error as StdError;
use std::str::FromStr;
use wasm_bindgen::JsValue;
use web_sys::window;

pub struct Storage {
    inner: web_sys::Storage,
}

pub fn local_storage() -> Result<Storage> {
    let storage = window()
        .context("no window")?
        .local_storage()
        .map_err(js_to_anyhow)
        .context("no access to local storage")?
        .context("no local storage")?;

    Ok(Storage { inner: storage })
}

impl Storage {
    pub fn get_item<T>(&self, name: &str) -> Result<Option<T>>
    where
        T: FromStr,
        <T as FromStr>::Err: StdError + Send + Sync + 'static,
    {
        let value = self
            .inner
            .get_item(name)
            .map_err(js_to_anyhow)
            .with_context(|| format!("Failed to get item from key {name}"))?;

        let value = match value {
            Some(value) => value,
            None => return Ok(None),
        };

        let t = T::from_str(&value).context("failed to parse item from string")?;

        Ok(Some(t))
    }

    pub fn set_item<V>(&self, name: &str, value: V) -> Result<()>
    where
        V: ToString,
    {
        self.inner
            .set_item(name, &value.to_string())
            .map_err(js_to_anyhow)
            .with_context(|| format!("Failed to set item to key {name}"))?;

        Ok(())
    }

    pub fn _remove_item(&self, name: &str) -> Result<()> {
        self.inner
            .remove_item(name)
            .map_err(js_to_anyhow)
            .with_context(|| format!("Failed to remove item from key {name}"))?;

        Ok(())
    }
}

fn js_to_anyhow(e: JsValue) -> anyhow::Error {
    anyhow!(e
        .as_string()
        .unwrap_or_else(|| "no error message".to_string()))
}
