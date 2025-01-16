use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use rand::thread_rng;
use rand::RngCore;
use sha2::Sha256;
use srp::client::SrpClient;
use srp::client::SrpClientVerifier;
use srp::groups::G_2048;
use std::sync::LazyLock;
use std::sync::Mutex;
use std::sync::OnceLock;

// This client is stateless.
static CLIENT: OnceLock<SrpClient<Sha256>> = OnceLock::new();

// This client is stateful. It is created in `process_login_response`, for a particular login
// attempt, and consumed in `verify_server`.
static CLIENT_VERIFIER: LazyLock<Mutex<Option<SrpClientVerifier<Sha256>>>> =
    LazyLock::new(|| Mutex::new(None));

#[derive(Debug)]
pub struct Verifier(Vec<u8>);

impl Verifier {
    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

#[derive(Debug)]
pub struct Salt(Vec<u8>);

impl Salt {
    pub fn try_from_hex(salt: String) -> Result<Self> {
        let salt = hex::decode(salt)?;

        Ok(Self(salt))
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

pub fn begin_registration(username: String, password: String) -> (Verifier, Salt) {
    let mut rng = thread_rng();

    let client = CLIENT.get_or_init(|| SrpClient::new(&G_2048));

    let mut salt = [0u8; 16];
    rng.fill_bytes(&mut salt);
    let salt = Salt(salt.to_vec());

    let verifier = client.compute_verifier(username.as_bytes(), password.as_bytes(), &salt.0);
    let verifier = Verifier(verifier);

    (verifier, salt)
}

/// Public ephemeral value sent by the server after trying to authenticate with a given username.
pub struct B(Vec<u8>);

impl B {
    pub fn try_from_hex(b_pub: String) -> Result<Self> {
        let b_pub = hex::decode(b_pub)?;

        Ok(Self(b_pub))
    }
}

pub fn process_login_response(
    username: String,
    password: String,
    salt: Salt,
    b_pub: B,
) -> Result<(A, ClientProof)> {
    let mut rng = thread_rng();

    let client = CLIENT.get_or_init(|| SrpClient::new(&G_2048));

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

    let mut guard = CLIENT_VERIFIER.lock().expect("to get lock");
    guard.replace(client_verifier);

    Ok((a_pub, client_proof))
}

/// Public ephemeral value sent by the client after processing [`B`].
pub struct A(Vec<u8>);

impl A {
    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

/// Verification data sent by the client to the server after processing [`B`].
pub struct ClientProof(Vec<u8>);

impl ClientProof {
    pub fn to_hex(&self) -> String {
        hex::encode(self.0.clone())
    }
}

/// Verification data sent by the server to the client after processing [`A`].
pub struct ServerProof(Vec<u8>);

impl ServerProof {
    pub fn try_from_hex(proof: String) -> Result<Self> {
        let proof = hex::decode(proof)?;

        Ok(Self(proof))
    }
}

pub fn verify_server(server_proof: ServerProof) -> Result<()> {
    let mut guard = CLIENT_VERIFIER.lock().expect("to get lock");

    let client_verifier = guard
        .take()
        .ok_or_else(|| anyhow!("Client verifier not set"))?;

    client_verifier
        .verify_server(&server_proof.0)
        .map_err(|e| anyhow!("{e}"))
        .context("Failed to verify server proof")?;

    Ok(())
}
