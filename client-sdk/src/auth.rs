//! SRP (Secure Remote Password) authentication implementation. This module is just a thin wrapper
//! around the `srp` library.
//!
//! This module provides a secure authentication mechanism that never transmits passwords over the
//! network. Instead, it uses zero-knowledge proofs to verify that both client and server know the
//! password.
//! ```

use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use rand::RngCore;
use sha2::Sha256;
use srp::client::SrpClient;
use srp::client::SrpClientVerifier;

/// Password verifier that can be safely stored on the server.
///
/// This value is derived from the user's password but cannot be used to recover the original
/// password.
#[derive(Debug)]
pub struct Verifier(Vec<u8>);

impl Verifier {
    /// Convert the verifier to a hex string for storage or transmission.
    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

/// Random salt.
#[derive(Debug)]
pub struct Salt(Vec<u8>);

impl Salt {
    /// Create a [`Salt`] from a hex string.
    ///
    /// # Errors
    ///
    /// Returns an error if the input is not valid hex.
    pub fn try_from_hex(salt: String) -> Result<Self> {
        let salt = hex::decode(salt)?;

        Ok(Self(salt))
    }

    /// Convert the salt to a hex string for storage or transmission.
    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

/// Begin user registration by generating a password verifier and salt.
///
/// This function should be called when a new user registers. The returned
/// verifier and salt should be sent to the server for storage.
///
/// # Arguments
///
/// * `rng` - Random number generator for salt generation
/// * `client` - SRP client instance
/// * `username` - The user's username
/// * `password` - The user's password (will not be stored or transmitted)
///
/// # Returns
///
/// A tuple of `(Verifier, Salt)` to be stored on the server.
///
/// # Example
///
/// ```rust,no_run
/// # use client_sdk::auth;
/// # use client_sdk::srp::client::SrpClient;
/// # use client_sdk::srp::groups::G_2048;
/// # use sha2::Sha256;
/// # use rand::thread_rng;
/// # let srp_client = SrpClient::<Sha256>::new(&G_2048);
/// # let mut rng = thread_rng();
/// let (verifier, salt) = auth::begin_registration(
///     &mut rng,
///     &srp_client,
///     "alice".to_string(),
///     "secure_password".to_string(),
/// );
/// // Send verifier.to_hex() and salt.to_hex() to server
/// ```
pub fn begin_registration<R>(
    rng: &mut R,
    client: &SrpClient<Sha256>,
    username: String,
    password: String,
) -> (Verifier, Salt)
where
    R: RngCore,
{
    let mut salt = [0u8; 16];
    rng.fill_bytes(&mut salt);
    let salt = Salt(salt.to_vec());

    let verifier = client.compute_verifier(username.as_bytes(), password.as_bytes(), &salt.0);
    let verifier = Verifier(verifier);

    (verifier, salt)
}

/// Server's public ephemeral value (B) used in the SRP protocol.
///
/// This value is sent by the server after receiving the username during login.
/// It's combined with the client's ephemeral value to create a shared session key.
pub struct B(Vec<u8>);

impl B {
    /// Create B from a hex string received from the server.
    ///
    /// # Errors
    ///
    /// Returns an error if the input is not valid hex.
    pub fn try_from_hex(b_pub: String) -> Result<Self> {
        let b_pub = hex::decode(b_pub)?;

        Ok(Self(b_pub))
    }
}

/// Process the server's login challenge and generate client proof.
///
/// This function should be called after receiving the server's public ephemeral value (B) and salt
/// during the login process.
///
/// # Arguments
///
/// * `rng` - Random number generator for ephemeral key generation
/// * `client` - SRP client instance
/// * `username` - The user's username
/// * `password` - The user's password
/// * `salt` - Salt received from the server
/// * `b_pub` - Server's public ephemeral value
///
/// # Returns
///
/// A tuple containing:
/// - `A`: Client's public ephemeral value to send to server
/// - `ClientProof`: Proof that client knows the password
/// - `SrpClientVerifier`: Verifier for validating server's proof
///
/// # Errors
///
/// Returns an error if the server's values are invalid or the protocol fails.
pub fn process_login_response<R>(
    rng: &mut R,
    client: &SrpClient<Sha256>,
    username: String,
    password: String,
    salt: Salt,
    b_pub: B,
) -> Result<(A, ClientProof, SrpClientVerifier<Sha256>)>
where
    R: RngCore,
{
    let mut a = [0u8; 64];
    rng.fill_bytes(&mut a);

    let client_verifier = client
        .process_reply(
            &a,
            username.as_bytes(),
            password.as_bytes(),
            &salt.0,
            &b_pub.0,
        )
        .map_err(|e| anyhow!("{e}"))
        .context("Failed to process B")?;

    let a_pub = client.compute_public_ephemeral(&a);
    let a_pub = A(a_pub);

    let client_proof = client_verifier.proof();
    let client_proof = ClientProof(client_proof.to_vec());

    Ok((a_pub, client_proof, client_verifier))
}

/// Client's public ephemeral value (A) used in the SRP protocol.
///
/// This value is sent to the server along with the client proof during login.
pub struct A(Vec<u8>);

impl A {
    /// Convert to hex string for transmission to server.
    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

/// Proof that the client knows the correct password.
///
/// This proof is sent to the server to demonstrate password knowledge without transmitting the
/// password itself.
pub struct ClientProof(Vec<u8>);

impl ClientProof {
    /// Convert to hex string for transmission to server.
    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

/// Proof that the server knows the correct password verifier.
///
/// This proof is sent by the server after validating the client's proof, confirming mutual
/// authentication.
pub struct ServerProof(Vec<u8>);

impl ServerProof {
    /// Create ServerProof from a hex string received from server.
    ///
    /// # Errors
    ///
    /// Returns an error if the input is not valid hex.
    pub fn try_from_hex(proof: String) -> Result<Self> {
        let proof = hex::decode(proof)?;

        Ok(Self(proof))
    }
}

/// Verify that the server knows the correct password verifier.
///
/// This function should be called after receiving the server's proof to complete mutual
/// authentication.
///
/// # Arguments
///
/// * `client_verifier` - The verifier returned from `process_login_response`
/// * `server_proof` - Server's proof received after sending client proof
///
/// # Returns
///
/// Ok(()) if the server is authenticated, otherwise an error.
///
/// # Errors
///
/// Returns an error if the server proof is invalid, indicating the server doesn't have the correct
/// password verifier.
pub fn verify_server(
    client_verifier: &SrpClientVerifier<Sha256>,
    server_proof: ServerProof,
) -> Result<()> {
    client_verifier
        .verify_server(&server_proof.0)
        .map_err(|e| anyhow!("{e}"))
        .context("Failed to verify server proof")?;

    Ok(())
}
