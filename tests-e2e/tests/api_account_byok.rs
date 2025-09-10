#![allow(clippy::unwrap_used)]

use crate::common::init_tracing;
use crate::common::new_wallet;
use bitcoin::hex::DisplayHex;
use reqwest::header::HeaderMap;
use reqwest::header::HeaderValue;
use reqwest::Client;
use serde_json::json;
use sha2::Digest;
use sha2::Sha256;

pub mod common;

/// Test for BYOK (Bring Your Own Key) API account registration.
///
/// Run `just prepare-e2e` before this test.
#[ignore]
#[tokio::test]
async fn api_account_byok_register_and_use() {
    init_tracing();

    // 1. Generate a client-side API key (simulating what a client would do).
    let client_api_key = generate_test_api_key();

    let referral_code = "demo";

    // 2. Register a new BYOK borrower API account.
    let res = Client::new()
        .post("http://localhost:7337/api/create-api-account/byok")
        .json(&json!({
            "name": "BYOK Borrower".to_string(),
            "email": format!("byok-{client_api_key}@test.com").to_string(),
            "timezone": Some("UTC".to_string()),
            "api_key": client_api_key.clone(),
            "referral_code": referral_code.to_string(),
        }))
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_success(),
        "Failed to create BYOK account: {:?}",
        res.text().await
    );

    // 3. Try to register with used email: get a 400.
    let res = Client::new()
        .post("http://localhost:7337/api/create-api-account/byok")
        .json(&json!({
            "name": "BYOK Borrower".to_string(),
            "email": format!("byok-{client_api_key}@test.com").to_string(),
            "timezone": Some("UTC".to_string()),
            "api_key": client_api_key.clone(),
            "referral_code": referral_code.to_string(),
        }))
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_client_error(),
        "Was able to create BYOK account with used email",
    );

    // 4. Try to register with used API key: get a 500.
    let res = Client::new()
        .post("http://localhost:7337/api/create-api-account/byok")
        .json(&json!({
            "name": "BYOK Borrower".to_string(),
            // Use new email to test API key reuse.
            "email": format!("byok2-{client_api_key}@test.com").to_string(),
            "timezone": Some("UTC".to_string()),
            "api_key": client_api_key.clone(),
            "referral_code": referral_code.to_string(),
        }))
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_server_error(),
        "Was able to create BYOK account with used API key",
    );

    // 5. Test that the API key works by fetching contracts.
    let borrower = {
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_str(&client_api_key).unwrap());

        Client::builder().default_headers(headers).build().unwrap()
    };

    let res = borrower
        .get("http://localhost:7337/api/contracts")
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_success(),
        "Failed to fetch contracts with BYOK API key: {:?}",
        res.text().await
    );
}

/// Generate a test API key deterministically from a mnemonic.
fn generate_test_api_key() -> String {
    let mut wallet = new_wallet(
        "since burden argue crop curve window duck bird happy race episode sand",
        "regtest",
    );

    // A real client implementation should fix the derivation path, to be able to derive the API key
    // deterministically.
    let (pk, _) = wallet.next_hardened_pk().unwrap();

    let mut hasher = Sha256::new();
    hasher.update("key_id");
    hasher.update(pk.to_bytes());
    let key_id_hash = hasher.finalize();

    let mut hasher = Sha256::new();
    hasher.update("secret");
    hasher.update(pk.to_bytes());
    let secret_hash = hasher.finalize();

    // Generate key_id from key_id_hash (take first 6 bytes and convert to 12 hex chars)
    let key_id: String = key_id_hash[..6].to_lower_hex_string();

    // Generate secret from secret_hash (cycle through bytes until we get 43 hex chars)
    let secret: String = secret_hash.to_lower_hex_string();

    format!("lndst_sk_{key_id}_{secret}")
}
