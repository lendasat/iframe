# Lendasat Client SDK

A Rust SDK for building Lendasat clients.

## Features

- **Secure Authentication**: SRP (Secure Remote Password) protocol implementation for password-based authentication with the Lendasat server
- **Bitcoin Wallet Management**: HD wallet functionality with BIP39 mnemonic support to participate in Lendasat 2-of-3 multi-signature contracts

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
client-sdk = "0.1.0"
```

## Quick Start

### Authentication

```rust
use client_sdk::auth;
use client_sdk::srp::{client::SrpClient, groups::G_2048};
use rand::{thread_rng, Rng};
use sha2::Sha256;

let mut rng = thread_rng();

let srp_client = SrpClient::<Sha256>::new(&G_2048);

// Register a new user

let email = "alice@example.com".to_string();
let password = "secure_password".to_string();
let (verifier, salt) =
    auth::begin_registration(&mut rng, &srp_client, email.clone(), password.clone());

// Send email, verifier and salt to server via REST API to complete registration

// Later, authenticate the user

// Send login request to server, including email address

// The server responds with Salt and b_pub
let salt = auth::Salt::try_from_hex(
    "80c4d85c653a6864ca7819a7dcb9edf980b53b2a203ef3fc8f4b06b2a07002d0".to_string(),
)?;
let b_pub = auth::B::try_from_hex(
    "b5e2a7c3d4f8e9b1a2c3d4e5f6789012b5e2a7c3d4f8e9b1a2c3d4e5f6789012".to_string(),
)?;

let (a_pub, client_proof, client_verifier) =
    auth::process_login_response(&mut rng, &srp_client, email, password, salt, b_pub)?;

// Send email, a_pub and client proof to server via REST API

// The server responds with a server proof
let server_proof = auth::ServerProof::try_from_hex(
    "7d0dce41a01ae479b8e8a6ee9eaaebf0cd4aed7fe68630d294bb7725e60467c6".to_string(),
)?;

// Verify that the proof sent by the server is valid
auth::verify_server(&client_verifier, server_proof)?
```

### Wallet Management

```rust
use client_sdk::wallet::{Wallet, generate_mnemonic};
use rand::thread_rng;

let mut rng = thread_rng();

// Create a new wallet
let (wallet, mnemonic_ciphertext) = Wallet::random(
    &mut rng,
    "wallet_password",
    "bitcoin", // or "testnet", "regtest"
    0, // starting contract index
)?;

// Derive a new public key, to be shared with the Lendasat server
let (own_pk, derivation_path) = wallet.next_hardened_pk()?;

// Sign a PSBT
let signed_tx = wallet.sign_spend_collateral_psbt(
    psbt,
    collateral_descriptor,
    own_pk,
    Some(&derivation_path),
)?;
```

## Examples

See the `examples/` directory for usage examples:

- `authentication.rs` - Complete authentication flow

## License

[LICENSE PLACEHOLDER - Add your chosen license here]
