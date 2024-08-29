#![allow(clippy::unwrap_used)]

#[cfg(test)]
mod tests {
    use anyhow::Result;
    use hub::model::ContractRequestSchema;
    use hub::model::ContractStatus;
    use hub::model::CreateLoanOfferSchema;
    use hub::model::LoanAssetChain::Ethereum;
    use hub::model::LoanAssetType;
    use hub::model::LoanOffer;
    use hub::model::LoginUserSchema;
    use hub::routes::borrower::Contract;
    use reqwest::cookie::Jar;
    use reqwest::Client;
    use rust_decimal_macros::dec;
    use serde_json::json;
    use std::sync::Arc;
    use std::sync::Once;
    use std::time::Duration;

    /// Run `just prepare-e2e` before this test.
    #[ignore]
    #[tokio::test]
    async fn open_loan() {
        let env_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = format!("{env_dir}/../.env");
        dotenv::from_filename(env_path).ok();

        let network = std::env::var("NETWORK").unwrap_or("regtest".to_string());

        init_tracing();

        // 0. Log in borrower and lender.
        let borrower_cookie_jar = Arc::new(Jar::default());
        let borrower = Client::builder()
            .cookie_provider(borrower_cookie_jar)
            .build()
            .unwrap();

        let borrower_login = LoginUserSchema {
            email: "borrower@lendasat.com".to_string(),
            password: "password123".to_string(),
        };

        let res = borrower
            .post("http://localhost:7337/api/auth/login")
            .json(&borrower_login)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let lender_cookie_jar = Arc::new(Jar::default());
        let lender = Client::builder()
            .cookie_provider(lender_cookie_jar)
            .build()
            .unwrap();

        let lender_login = LoginUserSchema {
            email: "lender@lendasat.com".to_string(),
            password: "password123".to_string(),
        };

        let res = lender
            .post("http://localhost:7338/api/auth/login")
            .json(&lender_login)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        // 1. Lender creates loan offer.
        let loan_offer = CreateLoanOfferSchema {
            name: "a fantastic loan".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(10),
            loan_amount_min: dec!(10_000),
            loan_amount_max: dec!(50_000),
            duration_months_min: 1,
            duration_months_max: 12,
            loan_asset_type: LoanAssetType::Usdc,
            loan_asset_chain: Ethereum,
            loan_repayment_address:
                "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
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
        borrower_wallet::wallet::new_wallet("borrower", "regtest").unwrap();
        let borrower_pk = borrower_wallet::wallet::get_pk(0).unwrap();

        // This is a random address, since we don't care about payouts in this test.
        let borrower_btc_address = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr"
            .parse()
            .unwrap();

        let contract_request = ContractRequestSchema {
            loan_id: loan_offer.id,
            initial_ltv: dec!(0.25),
            loan_amount: dec!(20_000),
            initial_collateral_sats: 100_000,
            duration_months: 6,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address:
                "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
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

        if network == "regtest" {
            tracing::info!("Running on regtest");

            // In production, the borrower would use an _external_ wallet to publish the
            // transaction. As such, we can fake all this.
            let mempool = Client::new();
            let res = mempool
                .post("http://localhost:7339/tx")
                .json(&mempool_mock::PostTransaction {
                    address: contract
                        .contract_address
                        .clone()
                        .expect("contract address")
                        .to_string(),
                    amount: contract.collateral_sats,
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

            let faucet = Client::new();

            let contract_address = contract.contract_address.clone().expect("contract address");

            let res = faucet
                .post("https://faucet.mutinynet.com/api/onchain")
                .json(&json!({
                    "sats": contract.collateral_sats,
                    "address": contract_address
                }))
                .send()
                .await
                .unwrap();

            assert!(res.status().is_success());
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

        // 6. Hub tells lender to send principal to borrower on Ethereum.
        // 7. Borrower confirms payment.
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
                            return;
                        }

                        Some(contract.status)
                    }
                    None => None,
                };

                tracing::debug!(
                    "Waiting for contract {contract_id} to reach status {status:?}, current: {current:?}",
                );

                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        }).await.map_err(anyhow::Error::new)
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
