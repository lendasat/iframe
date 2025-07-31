#![allow(clippy::unwrap_used)]

use anyhow::Result;
use bitcoin::hashes::Hash;
use bitcoin::Txid;
use client_sdk::auth::process_login_response;
use client_sdk::auth::verify_server;
use client_sdk::auth::Salt;
use client_sdk::auth::ServerProof;
use client_sdk::auth::B;
use client_sdk::srp::client::SrpClient;
use client_sdk::srp::groups::G_2048;
use client_sdk::wallet::Wallet;
use hub::model::ContractStatus;
use hub::model::PakeLoginRequest;
use hub::model::PakeLoginResponse;
use hub::model::PakeVerifyRequest;
use hub::routes::borrower::Contract;
use rand::thread_rng;
use rand::Rng;
use reqwest::cookie::Jar;
use reqwest::Client;
use serde::Deserialize;
use serde::Serialize;
use sqlx::FromRow;
use std::sync::Arc;
use std::sync::Once;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct PaginatedContractsResponse {
    pub data: Vec<Contract>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct LoanOffer {
    pub id: String,
}

pub async fn log_in(port: u32, email: String, password: String) -> Client {
    #[derive(Deserialize)]
    struct PakeVerifyResponse {
        pub server_proof: String,
    }

    let cookie_jar = Arc::new(Jar::default());
    let client = Client::builder()
        .cookie_provider(cookie_jar)
        .build()
        .unwrap();

    let login_request = PakeLoginRequest {
        email: email.clone(),
    };

    let res = client
        .post(format!("http://localhost:{port}/api/auth/pake-login"))
        .json(&login_request)
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success());

    let login_response: PakeLoginResponse = res.json().await.unwrap();

    let mut rng = thread_rng();

    let (a_pub, client_proof, client_verifier) = process_login_response(
        &mut rng,
        &SrpClient::new(&G_2048),
        email.clone(),
        password,
        Salt::try_from_hex(login_response.salt).unwrap(),
        B::try_from_hex(login_response.b_pub).unwrap(),
    )
    .unwrap();

    let verify_payload = PakeVerifyRequest {
        email: email.clone(),
        a_pub: a_pub.to_hex(),
        client_proof: client_proof.to_hex(),
    };

    let res = client
        .post(format!("http://localhost:{port}/api/auth/pake-verify"))
        .json(&verify_payload)
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success());

    let verify_response: PakeVerifyResponse = res.json().await.unwrap();

    verify_server(
        &client_verifier,
        ServerProof::try_from_hex(verify_response.server_proof).unwrap(),
    )
    .unwrap();

    tracing::debug!(email, "Logged in");

    client
}

pub fn new_wallet(mnemonic: &str, network: &str) -> Wallet {
    let mut rng = thread_rng();
    let contract_index = rng.gen_range(0..(2_u32.pow(31)));

    let (wallet, _) = Wallet::new(
        &mut rng,
        mnemonic.parse().unwrap(),
        "foo",
        network,
        contract_index,
    )
    .unwrap();

    wallet
}

/// waits until we have a contract with status.
///
/// Note: this api only works for the borrower
pub async fn wait_until_contract_status(
    client: &Client,
    url: &str,
    contract_id: &str,
    status: ContractStatus,
    network: &str,
) -> Result<()> {
    let timeout = if network == "regtest" {
        Duration::from_secs(10)
    } else {
        Duration::from_secs(120)
    };

    tokio::time::timeout(timeout, async {
        loop {
            let res = client
                .get(format!("http://{url}/api/contracts"))
                .send()
                .await
                .unwrap();

            let response: PaginatedContractsResponse = res.json().await.unwrap();
            let contracts = response.data;

            let current = match contracts.iter().find(|c| c.id == contract_id) {
                Some(contract) => {
                    if contract.status == status {
                        tracing::debug!(
                                "Contract {contract_id} reached status {status:?}",
                            );

                        return;
                    }

                    Some(contract.status)
                }
                None => None,
            };

            tracing::debug!(
                    "Waiting for contract {contract_id} to reach status {status:?}, current: {current:?}",
                );

            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }).await.map_err(anyhow::Error::new)
}

pub fn random_txid() -> Txid {
    let mut rng = thread_rng();

    let mut bytes = [0u8; 32];
    rng.fill(&mut bytes);

    Txid::from_slice(&bytes).unwrap()
}

pub fn init_tracing() {
    static TRACING_TEST_SUBSCRIBER: Once = Once::new();

    TRACING_TEST_SUBSCRIBER.call_once(|| {
        tracing_subscriber::fmt()
            .with_env_filter(
                "debug,\
                 hyper=warn,\
                 reqwest=warn,\
                 rustls=warn",
            )
            .with_test_writer()
            .init()
    })
}
