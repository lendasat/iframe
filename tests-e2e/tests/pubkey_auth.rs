#![allow(clippy::unwrap_used)]

use crate::common::init_tracing;
use bitcoin::secp256k1::Message;
use bitcoin::secp256k1::Secp256k1;
use bitcoin::secp256k1::SecretKey;
use rand::thread_rng;
use reqwest::cookie::Jar;
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use sha2::Digest;
use sha2::Sha256;
use std::sync::Arc;

pub mod common;

/// Test for pubkey-based authentication flow.
///
/// Run `just prepare-e2e` before this test.
#[ignore]
#[tokio::test]
async fn pubkey_auth_register_and_login() {
    init_tracing();

    let secp = Secp256k1::new();

    let mut rng = thread_rng();
    // 1. Generate a secp256k1 keypair
    let secret_key = SecretKey::new(&mut rng);

    let public_key = secret_key.public_key(&secp);
    let pubkey_str = public_key.to_string();

    tracing::info!("Generated pubkey: {}", pubkey_str);

    let email = format!("pubkey-test-{}@example.com", uuid::Uuid::new_v4());
    let name = "Pubkey Test User";
    let referral_code = "demo";

    // 2. Request a challenge
    tracing::info!("Requesting challenge for pubkey authentication");

    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-challenge")
        .json(&json!({
            "pubkey": pubkey_str,
        }))
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_success(),
        "Failed to request challenge: {:?}",
        res.text().await
    );

    #[derive(Deserialize)]
    struct ChallengeResponse {
        challenge: String,
    }

    let challenge_response: ChallengeResponse = res.json().await.unwrap();
    let challenge = challenge_response.challenge;

    tracing::info!("Received challenge: {}", challenge);

    // 3. Register a new user with the pubkey
    tracing::info!("Registering new pubkey user");

    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-register")
        .json(&json!({
            "name": name,
            "email": email,
            "pubkey": pubkey_str,
            "invite_code": referral_code,
        }))
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_success(),
        "Failed to register pubkey user: {:?}",
        res.text().await
    );

    tracing::info!("Successfully registered pubkey user");

    // 4. Try to register again with the same pubkey - should fail with 409
    tracing::info!("Attempting duplicate registration with same pubkey");

    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-register")
        .json(&json!({
            "name": name,
            "email": format!("different-{}@example.com", uuid::Uuid::new_v4()),
            "pubkey": pubkey_str,
            "invite_code": referral_code,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        res.status(),
        reqwest::StatusCode::CONFLICT,
        "Expected CONFLICT when registering duplicate pubkey, got: {:?}",
        res.text().await
    );

    tracing::info!("Duplicate pubkey registration correctly rejected");

    // 5. Try to register again with the same email - should fail with 409
    tracing::info!("Attempting duplicate registration with same email");

    let different_secret_key = SecretKey::from_slice(&[
        0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
        0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
        0x11, 0x11,
    ])
    .unwrap();

    let different_public_key = different_secret_key.public_key(&secp);
    let different_pubkey_str = different_public_key.to_string();

    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-register")
        .json(&json!({
            "name": name,
            "email": email,
            "pubkey": different_pubkey_str,
            "invite_code": referral_code,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        res.status(),
        reqwest::StatusCode::CONFLICT,
        "Expected CONFLICT when registering duplicate email, got: {:?}",
        res.text().await
    );

    tracing::info!("Duplicate email registration correctly rejected");

    // 6. Request a new challenge for authentication
    tracing::info!("Requesting new challenge for authentication");

    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-challenge")
        .json(&json!({
            "pubkey": pubkey_str,
        }))
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success());
    let challenge_response: ChallengeResponse = res.json().await.unwrap();
    let challenge = challenge_response.challenge;

    tracing::info!("Received authentication challenge: {}", challenge);

    // 7. Sign the challenge
    let challenge_hash = Sha256::digest(challenge.as_bytes());
    let message = Message::from_digest_slice(&challenge_hash).unwrap();
    let signature = secp.sign_ecdsa(&message, &secret_key);
    let signature_str = signature.to_string();

    tracing::info!("Signed challenge with signature: {}", signature_str);

    // 8. Verify the signature and log in
    tracing::info!("Verifying signature and logging in");

    let cookie_jar = Arc::new(Jar::default());
    let client = Client::builder()
        .cookie_provider(cookie_jar.clone())
        .build()
        .unwrap();

    let res = client
        .post("http://localhost:7337/api/auth/pubkey-verify")
        .json(&json!({
            "pubkey": pubkey_str,
            "challenge": challenge,
            "signature": signature_str,
        }))
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_success(),
        "Failed to verify signature and login: {:?}",
        res.text().await
    );

    #[derive(Deserialize)]
    struct VerifyResponse {
        token: String,
    }

    let verify_response: VerifyResponse = res.json().await.unwrap();
    assert!(!verify_response.token.is_empty());

    tracing::info!("Successfully authenticated, received JWT token");

    // 9. Use the authenticated session to call /me endpoint
    tracing::info!("Calling /me endpoint with authenticated session");

    let res = client
        .get("http://localhost:7337/api/users/me")
        .send()
        .await
        .unwrap();

    assert!(
        res.status().is_success(),
        "Failed to call /me endpoint: {:?}",
        res.text().await
    );

    #[derive(Deserialize)]
    struct MeResponse {
        user: UserInfo,
    }

    #[derive(Deserialize)]
    struct UserInfo {
        name: String,
        email: Option<String>,
    }

    let me_response: MeResponse = res.json().await.unwrap();

    assert_eq!(me_response.user.name, name);
    assert_eq!(me_response.user.email.as_deref(), Some(email.as_str()));

    tracing::info!("Successfully verified user profile via /me endpoint");
    tracing::info!(
        "User: {} ({})",
        me_response.user.name,
        me_response.user.email.unwrap_or_default()
    );
}

/// Test invalid signature rejection
#[ignore]
#[tokio::test]
async fn pubkey_auth_invalid_signature() {
    init_tracing();

    let secp = Secp256k1::new();

    // Generate keypair and register
    let secret_key = SecretKey::from_slice(&[
        0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00,
        0x11, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
        0x00, 0x11,
    ])
    .unwrap();

    let public_key = secret_key.public_key(&secp);
    let pubkey_str = public_key.to_string();

    let email = format!("pubkey-invalid-sig-{}@example.com", uuid::Uuid::new_v4());

    // Register user
    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-register")
        .json(&json!({
            "name": "Invalid Sig Test",
            "email": email,
            "pubkey": pubkey_str,
            "invite_code": "demo",
        }))
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success());

    // Request challenge
    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-challenge")
        .json(&json!({
            "pubkey": pubkey_str,
        }))
        .send()
        .await
        .unwrap();

    #[derive(Deserialize)]
    struct ChallengeResponse {
        challenge: String,
    }

    let challenge_response: ChallengeResponse = res.json().await.unwrap();
    let challenge = challenge_response.challenge;

    // Sign with WRONG key
    let wrong_secret_key = SecretKey::from_slice(&[
        0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33,
        0x22, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44,
        0x33, 0x22,
    ])
    .unwrap();

    let challenge_hash = Sha256::digest(challenge.as_bytes());
    let message = Message::from_digest_slice(&challenge_hash).unwrap();
    let wrong_signature = secp.sign_ecdsa(&message, &wrong_secret_key);
    let wrong_signature_str = wrong_signature.to_string();

    // Try to verify with wrong signature
    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-verify")
        .json(&json!({
            "pubkey": pubkey_str,
            "challenge": challenge,
            "signature": wrong_signature_str,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        res.status(),
        reqwest::StatusCode::UNAUTHORIZED,
        "Expected UNAUTHORIZED for invalid signature, got: {:?}",
        res.text().await
    );

    tracing::info!("Invalid signature correctly rejected");
}

/// Test expired challenge rejection
#[ignore]
#[tokio::test]
async fn pubkey_auth_expired_challenge() {
    init_tracing();

    let secp = Secp256k1::new();

    let secret_key = SecretKey::from_slice(&[
        0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33,
        0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33,
        0x33, 0x33,
    ])
    .unwrap();

    let public_key = secret_key.public_key(&secp);
    let pubkey_str = public_key.to_string();

    let email = format!("pubkey-expired-{}@example.com", uuid::Uuid::new_v4());

    // Register user
    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-register")
        .json(&json!({
            "name": "Expired Challenge Test",
            "email": email,
            "pubkey": pubkey_str,
            "invite_code": "demo",
        }))
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success());

    // Request challenge
    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-challenge")
        .json(&json!({
            "pubkey": pubkey_str,
        }))
        .send()
        .await
        .unwrap();

    #[derive(Deserialize)]
    struct ChallengeResponse {
        challenge: String,
    }

    let challenge_response: ChallengeResponse = res.json().await.unwrap();
    let challenge = challenge_response.challenge;

    // Sign the challenge
    let challenge_hash = Sha256::digest(challenge.as_bytes());
    let message = Message::from_digest_slice(&challenge_hash).unwrap();
    let signature = secp.sign_ecdsa(&message, &secret_key);
    let signature_str = signature.to_string();

    // Wait for challenge to expire (5 minutes + buffer)
    tracing::info!("Waiting for challenge to expire (this will take ~5 minutes)...");
    tokio::time::sleep(tokio::time::Duration::from_secs(301)).await;

    // Try to verify with expired challenge
    let res = Client::new()
        .post("http://localhost:7337/api/auth/pubkey-verify")
        .json(&json!({
            "pubkey": pubkey_str,
            "challenge": challenge,
            "signature": signature_str,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        res.status(),
        reqwest::StatusCode::BAD_REQUEST,
        "Expected BAD_REQUEST for expired challenge, got: {:?}",
        res.text().await
    );

    tracing::info!("Expired challenge correctly rejected");
}
