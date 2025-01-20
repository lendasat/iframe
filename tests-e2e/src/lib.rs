#![allow(clippy::unwrap_used)]

#[cfg(test)]
mod tests {
    use anyhow::Result;
    use bitcoin::hashes::Hash;
    use bitcoin::Psbt;
    use bitcoin::Txid;
    use browser_wallet::auth::Salt;
    use browser_wallet::auth::ServerProof;
    use browser_wallet::auth::B;
    use hub::model::ContractRequestSchema;
    use hub::model::ContractStatus;
    use hub::model::CreateLoanOfferSchema;
    use hub::model::Integration;
    use hub::model::LoanAssetChain::Ethereum;
    use hub::model::LoanAssetType;
    use hub::model::PakeLoginRequest;
    use hub::model::PakeLoginResponse;
    use hub::model::PakeVerifyRequest;
    use hub::routes::borrower::ClaimCollateralPsbt;
    use hub::routes::borrower::ClaimTx;
    use hub::routes::borrower::Contract;
    use rand::Rng;
    use reqwest::cookie::Jar;
    use reqwest::Client;
    use rust_decimal_macros::dec;
    use serde::Deserialize;
    use serde::Serialize;
    use serde_json::json;
    use sqlx::FromRow;
    use std::sync::Arc;
    use std::sync::Once;
    use std::time::Duration;

    #[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
    pub struct LoanOffer {
        pub id: String,
    }

    /// Run `just prepare-e2e` before this test.
    #[ignore]
    #[tokio::test]
    async fn open_and_repay_loan() {
        let env_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        let network = std::env::var("NETWORK").unwrap_or("regtest".to_string());

        init_tracing();

        // 0. Log in borrower and lender.
        let borrower = log_in(
            7337,
            "borrower@lendasat.com".to_string(),
            "password123".to_string(),
        )
        .await;

        let lender = log_in(
            7338,
            "lender@lendasat.com".to_string(),
            "password123".to_string(),
        )
        .await;

        // 1. Lender creates loan offer.
        let lender_xpub = "tpubD6NzVbkrYhZ4Yon2URjspXp7Y7DKaBaX1ZVMCEnhc8zCrj1AuJyLrhmAKFmnkqVULW6znfEMLvgukHBVJD4fukpVYre3dpHXmkbcpvtviro".parse().unwrap();
        let loan_offer = CreateLoanOfferSchema {
            name: "a fantastic loan".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.10),
            loan_amount_min: dec!(1_000),
            loan_amount_max: dec!(50_000),
            loan_amount_reserve: dec!(50_000),
            duration_months_min: 1,
            duration_months_max: 12,
            loan_asset_type: LoanAssetType::Usdc,
            loan_asset_chain: Ethereum,
            loan_repayment_address:
                "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
            auto_accept: false,
            lender_xpub,
        };

        let res = lender
            .post("http://localhost:7338/api/offers/create")
            .json(&loan_offer)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let loan_offer: LoanOffer = res.json().await.unwrap();

        // 2. Borrower takes loan offer by creating a contract request.
        let borrower_pk = {
            let (_, network, xpub) =
                browser_wallet::wallet::new_wallet("borrower", "regtest", None).unwrap();

            browser_wallet::wallet::get_normal_pk_for_network(
                &xpub.to_string(),
                &network.to_string(),
            )
            .unwrap()
        };

        let borrower_btc_address = "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37"
            .parse()
            .unwrap();

        let contract_request = ContractRequestSchema {
            loan_id: loan_offer.id,
            // TODO: This loan amount can cause the collateral to be over the Mutinynet faucet limit
            // if the real price of Bitcoin changes enough. We should mock the price in
            // the `hub` for the e2e tests.
            loan_amount: dec!(500),
            duration_months: 6,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address: Some(
                "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
            ),
            integration: Integration::StableCoin,
            moon_card_id: None,
        };

        let res = borrower
            .post("http://localhost:7337/api/contracts")
            .json(&contract_request)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let contract: Contract = res.json().await.unwrap();

        // 3. Lender accepts contract request.

        let res = lender
            .put(format!(
                "http://localhost:7338/api/contracts/{}/approve",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        // 4. Borrower pays to collateral address.

        let res = borrower
            .get("http://localhost:7337/api/contracts")
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let contracts: Vec<Contract> = res.json().await.unwrap();
        let contract = contracts.iter().find(|c| c.id == contract.id).unwrap();

        let total_collateral = contract.initial_collateral_sats + contract.origination_fee_sats;

        if network == "regtest" {
            tracing::info!("Running on regtest");

            // In production, the borrower would use an _external_ wallet to publish the
            // transaction. As such, we can fake all this.
            let mempool = Client::new();
            let res = mempool
                .post("http://localhost:7339/sendtoaddress")
                .json(&mempool_mock::SendToAddress {
                    address: contract
                        .contract_address
                        .clone()
                        .expect("contract address")
                        .to_string(),
                    amount: total_collateral,
                })
                .send()
                .await
                .unwrap();

            assert!(res.status().is_success());

            let res = mempool
                .post("http://localhost:7339/mine/6")
                .send()
                .await
                .unwrap();

            assert!(res.status().is_success());
        } else {
            tracing::info!("Running on signet");

            let faucet = Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .expect("valid build");

            let contract_address = contract.contract_address.clone().expect("contract address");

            // Testing the ability to fund the collateral with several outputs.

            // We add 1 to ensure that we don't round down.
            let half = (total_collateral + 1) / 2;
            for i in 0..=1 {
                tracing::debug!(i, amount = %half, "Funding collateral");

                let res = faucet
                    .post("https://faucet.mutinynet.com/api/onchain")
                    .json(&json!({
                        "sats": half,
                        "address": contract_address
                    }))
                    .send()
                    .await
                    .unwrap();

                let status = res.status();

                if !status.is_success() {
                    let msg = res.text().await.unwrap();
                    tracing::error!("Failed to use Mutinynet faucet: {msg}");
                }

                assert!(status.is_success());

                tracing::debug!(i, amount = %half, "Locked up collateral");
            }
        }

        // 5. Hub sees collateral funding TX.

        let res = borrower
            .get("http://localhost:7337/api/contracts")
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let contracts: Vec<Contract> = res.json().await.unwrap();
        let contract = contracts.iter().find(|c| c.id == contract.id).unwrap();

        wait_until_contract_status(
            &borrower,
            "localhost:7337",
            &contract.id,
            ContractStatus::CollateralConfirmed,
            &network,
        )
        .await
        .unwrap();

        // TODO: 6. Hub tells lender to send principal to borrower on Ethereum.

        // 7. Lender confirms principal was disbursed.

        // We need random TXIDs to avoid errors due to rerunning this test without wiping the DB.
        let loan_txid = random_txid();
        let res = lender
            .put(format!(
                "http://localhost:7338/api/contracts/{}/principalgiven?txid={loan_txid}",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        // 8. Repay loan on loan blockchain.

        let repayment_txid = random_txid();
        let res = borrower
            .put(format!(
                "http://localhost:7337/api/contracts/{}/repaid?txid={repayment_txid}",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let res = lender
            .put(format!(
                "http://localhost:7338/api/contracts/{}/principalconfirmed",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        // 9. Claim collateral on Bitcoin.
        // With DLCs, we will need to construct a spend transaction using the loan secret.

        let fee_rate = 1;
        let res = borrower
            .get(format!(
                "http://localhost:7337/api/contracts/{}/claim?fee_rate={fee_rate}",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let ClaimCollateralPsbt {
            psbt: claim_psbt,
            collateral_descriptor,
            borrower_pk,
        } = res.json().await.unwrap();

        let claim_psbt = hex::decode(claim_psbt).unwrap();
        let claim_psbt = Psbt::deserialize(&claim_psbt).unwrap();

        let tx =
            browser_wallet::wallet::sign_claim_psbt(claim_psbt, collateral_descriptor, borrower_pk)
                .unwrap();

        let tx_hex = bitcoin::consensus::encode::serialize_hex(&tx);

        let res = borrower
            .post(format!(
                "http://localhost:7337/api/contracts/{}",
                contract.id
            ))
            .json(&ClaimTx { tx: tx_hex })
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        if network == "regtest" {
            let mempool = Client::new();
            let res = mempool
                .post("http://localhost:7339/mine/2")
                .send()
                .await
                .unwrap();

            assert!(res.status().is_success());
        }

        wait_until_contract_status(
            &borrower,
            "localhost:7337",
            &contract.id,
            ContractStatus::Closed,
            &network,
        )
        .await
        .unwrap();
    }

    /// Run `just prepare-e2e` before this test.
    #[ignore]
    #[tokio::test]
    async fn open_a_loan_and_get_principal_in_pay_with_moon_card() {
        let env_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        let network = std::env::var("NETWORK").unwrap_or("regtest".to_string());

        init_tracing();

        // 0. Log in borrower and lender.
        let borrower = log_in(
            7337,
            "borrower@lendasat.com".to_string(),
            "password123".to_string(),
        )
        .await;

        let lender = log_in(
            7338,
            "lender@lendasat.com".to_string(),
            "password123".to_string(),
        )
        .await;

        // 1. Lender creates loan offer.
        let lender_xpub = "tpubD6NzVbkrYhZ4Yon2URjspXp7Y7DKaBaX1ZVMCEnhc8zCrj1AuJyLrhmAKFmnkqVULW6znfEMLvgukHBVJD4fukpVYre3dpHXmkbcpvtviro".parse().unwrap();
        let loan_offer = CreateLoanOfferSchema {
            name: "a fantastic loan".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.10),
            loan_amount_min: dec!(1_000),
            loan_amount_max: dec!(50_000),
            loan_amount_reserve: dec!(50_000),
            duration_months_min: 1,
            duration_months_max: 12,
            loan_asset_type: LoanAssetType::Usdc,
            loan_asset_chain: Ethereum,
            loan_repayment_address:
                "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
            auto_accept: false,
            lender_xpub,
        };

        let res = lender
            .post("http://localhost:7338/api/offers/create")
            .json(&loan_offer)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let loan_offer: LoanOffer = res.json().await.unwrap();

        // 2. Borrower takes loan offer by creating a contract request.

        let borrower_pk = {
            let (_, network, xpub) =
                browser_wallet::wallet::new_wallet("borrower", "regtest", None).unwrap();

            browser_wallet::wallet::get_normal_pk_for_network(
                &xpub.to_string(),
                &network.to_string(),
            )
            .unwrap()
        };

        let borrower_btc_address = "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37"
            .parse()
            .unwrap();

        let contract_request = ContractRequestSchema {
            loan_id: loan_offer.id,
            loan_amount: dec!(2_000),
            duration_months: 6,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address: None,
            // The borrower wants to get a Moon card with their stable coins.
            integration: Integration::PayWithMoon,
            moon_card_id: None,
        };

        let res = borrower
            .post("http://localhost:7337/api/contracts")
            .json(&contract_request)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let contract: Contract = res.json().await.unwrap();

        // 3. Lender accepts contract request.

        let res = lender
            .put(format!(
                "http://localhost:7338/api/contracts/{}/approve",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        // The borrower's Moon card is created as soon as the lender accepts the loan.

        // 4. Borrower pays to collateral address.

        let res = borrower
            .get("http://localhost:7337/api/contracts")
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let contracts: Vec<Contract> = res.json().await.unwrap();
        let contract = contracts.iter().find(|c| c.id == contract.id).unwrap();

        let total_collateral = contract.initial_collateral_sats + contract.origination_fee_sats;

        if network == "regtest" {
            tracing::info!("Running on regtest");

            // In production, the borrower would use an _external_ wallet to publish the
            // transaction. As such, we can fake all this.
            let mempool = Client::new();
            let res = mempool
                .post("http://localhost:7339/sendtoaddress")
                .json(&mempool_mock::SendToAddress {
                    address: contract
                        .contract_address
                        .clone()
                        .expect("contract address")
                        .to_string(),
                    amount: total_collateral,
                })
                .send()
                .await
                .unwrap();

            assert!(res.status().is_success());

            let res = mempool
                .post("http://localhost:7339/mine/6")
                .send()
                .await
                .unwrap();

            assert!(res.status().is_success());
        } else {
            tracing::info!("Running on signet");

            let faucet = Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .expect("valid build");

            let contract_address = contract.contract_address.clone().expect("contract address");

            // Testing the ability to fund the collateral with two outputs.

            // We add 1 to ensure that we don't round down.
            let half = (total_collateral + 1) / 2;
            for _ in 0..=1 {
                let res = faucet
                    .post("https://faucet.mutinynet.com/api/onchain")
                    .json(&json!({
                        "sats": half,
                        "address": contract_address
                    }))
                    .send()
                    .await
                    .unwrap();

                let status = res.status();

                assert!(status.is_success());
            }
        }

        // 5. Hub sees collateral funding TX.

        let res = borrower
            .get("http://localhost:7337/api/contracts")
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let contracts: Vec<Contract> = res.json().await.unwrap();
        let contract = contracts.iter().find(|c| c.id == contract.id).unwrap();

        wait_until_contract_status(
            &borrower,
            "localhost:7337",
            &contract.id,
            ContractStatus::CollateralConfirmed,
            &network,
        )
        .await
        .unwrap();

        // 6. Hub generates Pay with Moon on-chain USDC POLY invoice to add Moon Credit balance and
        //    shows the corresponding address to the lender.

        // 7. Lender pays invoice. (With the final protocol, the borrower must claim the principal
        //    HTLC to the invoice address instead of an address owned by them!)

        // 8. TODO: Hub checks that _address_ in invoice has received expected amount. We can only
        //    do this as soon as we know exactly how to use the webhook API!

        // 9. TODO: Hub adds balance to borrower card.

        // 10. TODO: Simulate spend.

        // We need random TXIDs to avoid errors due to rerunning this test without wiping the DB.
        let loan_txid = random_txid();
        let res = lender
            .put(format!(
                "http://localhost:7338/api/contracts/{}/principalgiven?txid={loan_txid}",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());
    }

    async fn log_in(port: u32, email: String, password: String) -> Client {
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

        let (a_pub, client_proof) = browser_wallet::auth::process_login_response(
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

        browser_wallet::auth::verify_server(
            ServerProof::try_from_hex(verify_response.server_proof).unwrap(),
        )
        .unwrap();

        tracing::debug!(email, "Logged in");

        client
    }

    async fn wait_until_contract_status(
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

                let contracts: Vec<Contract> = res.json().await.unwrap();
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

    fn random_txid() -> Txid {
        let mut rng = rand::thread_rng();

        let mut bytes = [0u8; 32];
        rng.fill(&mut bytes);

        Txid::from_slice(&bytes).unwrap()
    }

    fn init_tracing() {
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
}
