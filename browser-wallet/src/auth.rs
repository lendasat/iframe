use anyhow::anyhow;
use anyhow::Result;
use client_sdk::auth::ClientProof;
use client_sdk::auth::Salt;
use client_sdk::auth::ServerProof;
use client_sdk::auth::Verifier;
use client_sdk::auth::A;
use client_sdk::auth::B;
use rand::thread_rng;
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

pub fn begin_registration(username: String, password: String) -> (Verifier, Salt) {
    let mut rng = thread_rng();

    let client = CLIENT.get_or_init(|| SrpClient::new(&G_2048));

    client_sdk::auth::begin_registration(&mut rng, client, username, password)
}

pub fn process_login_response(
    username: String,
    password: String,
    salt: Salt,
    b_pub: B,
) -> Result<(A, ClientProof)> {
    let mut rng = thread_rng();

    let client = CLIENT.get_or_init(|| SrpClient::new(&G_2048));

    let (a_pub, client_proof, client_verifier) = client_sdk::auth::process_login_response(
        &mut rng, client, username, password, salt, b_pub,
    )?;

    let mut guard = CLIENT_VERIFIER.lock().expect("to get lock");
    guard.replace(client_verifier);

    Ok((a_pub, client_proof))
}

pub fn verify_server(server_proof: ServerProof) -> Result<()> {
    let mut guard = CLIENT_VERIFIER.lock().expect("to get lock");

    let client_verifier = guard
        .take()
        .ok_or_else(|| anyhow!("Client verifier not set"))?;

    client_sdk::auth::verify_server(&client_verifier, server_proof)?;

    Ok(())
}
