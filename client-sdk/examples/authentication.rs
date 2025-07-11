//! Complete SRP authentication flow example.
//!
//! This example demonstrates:
//! - User registration with SRP
//! - Login flow with server challenge/response
//! - Mutual authentication verification
//!
//! This example omits the communication with the server via REST API.

#![allow(clippy::print_stdout)]

use client_sdk::auth;
use client_sdk::auth::Salt;
use client_sdk::auth::ServerProof;
use client_sdk::auth::B;
use rand::thread_rng;
use sha2::Sha256;
use srp::client::SrpClient;
use srp::groups::G_2048;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = thread_rng();

    // Initialize SRP client (empty params for standard groups)
    let srp_client = SrpClient::<Sha256>::new(&G_2048);

    // REGISTRATION FLOW
    println!("=== Registration Flow ===");

    let username = "alice@example.com".to_string();
    let password = "very_secure_password_123".to_string();

    // Step 1: Generate verifier and salt for registration
    let (verifier, salt) =
        auth::begin_registration(&mut rng, &srp_client, username.clone(), password.clone());

    println!("Registration data generated:");
    println!("  Username: {username}");
    println!("  Salt (hex): {}", salt.to_hex());
    println!("  Verifier (hex): {}", verifier.to_hex());
    println!("\n📤 Send username, salt, and verifier to server for storage");

    // LOGIN FLOW
    println!("\n=== Login Flow ===");

    // Step 1: Client sends username to server
    println!("Step 1: Client → Server");
    println!("  Sending username: {username}");

    // Step 2: Server responds with salt and B
    println!("\nStep 2: Server → Client");
    println!("  Server sends back:");

    // Simulate server response (in real app, these come from server)
    let server_salt_hex = salt.to_hex(); // Server stored this during registration
    let server_b_hex = "b5e2a7c3d4f8e9b1a2c3d4e5f6789012b5e2a7c3d4f8e9b1a2c3d4e5f6789012"; // Server generates this

    println!("  Salt: {server_salt_hex}");
    println!("  B (server ephemeral): {server_b_hex}");

    // Parse server response
    let salt = Salt::try_from_hex(server_salt_hex)?;
    let b_pub = B::try_from_hex(
        // In a real scenario, use actual B from server
        server_b_hex.to_string(),
    )?;

    // Step 3: Process server response and generate client proof
    println!("\nStep 3: Client processes server response");
    let (a_pub, client_proof, client_verifier) = auth::process_login_response(
        &mut rng,
        &srp_client,
        username.clone(),
        password.clone(),
        salt,
        b_pub,
    )?;

    println!("  Generated:");
    println!("  A (client ephemeral): {}", a_pub.to_hex());
    println!("  Client proof: {}", client_proof.to_hex());

    // Step 4: Send A and proof to server
    println!("\nStep 4: Client → Server");
    println!("  Sending A and client proof");

    // Step 5: Server validates and responds with server proof
    println!("\nStep 5: Server → Client");
    println!("  Server validates client proof and sends server proof");

    // Simulate server proof (in real app, this comes from server)
    let server_proof_hex = "cafebabe12345678901234567890123456789012345678901234567890123456"; // Server generates after validating client
    let server_proof = ServerProof::try_from_hex(
        // In a real scenario, use actual proof from server
        server_proof_hex.to_string(),
    )?;

    // Step 6: Verify server proof
    println!("\nStep 6: Client verifies server");
    match auth::verify_server(&client_verifier, server_proof) {
        Ok(()) => {
            println!("✅ Server authenticated successfully!");
            println!("🔐 Mutual authentication complete - secure session established");
        }
        Err(e) => {
            println!(
                "❌ Server authentication failed (because we are using a random server proof): {e}"
            );
            println!("⚠️ Do not proceed - server may be compromised");
        }
    }

    Ok(())
}
