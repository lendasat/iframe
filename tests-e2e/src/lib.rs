#![allow(clippy::unwrap_used)]

#[cfg(test)]
mod tests {
    use anyhow::Result;
    use bitcoin::Amount;
    use bitcoin::Psbt;
    use hub::model::ContractRequestSchema;
    use hub::model::ContractStatus;
    use hub::model::CreateLoanOfferSchema;
    use hub::model::LoanAssetChain::Ethereum;
    use hub::model::LoanAssetType;
    use hub::model::LoanOffer;
    use hub::model::LoginUserSchema;
    use hub::routes::borrower::ClaimCollateralPsbt;
    use hub::routes::borrower::ClaimTx;
    use hub::routes::borrower::Contract;
    use reqwest::cookie::Jar;
    use reqwest::Client;
    use rust_decimal::prelude::ToPrimitive;
    use rust_decimal::Decimal;
    use rust_decimal_macros::dec;
    use serde_json::json;
    use std::sync::Arc;
    use std::sync::Once;
    use std::time::Duration;

    const ORIGINATION_FEE_RATE: f32 = 0.01;

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
            interest_rate: dec!(0.10),
            loan_amount_min: dec!(1_000),
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

        let borrower_wallet_index = 0;
        let borrower_pk = borrower_wallet::wallet::get_pk(borrower_wallet_index).unwrap();

        let borrower_btc_address = "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37"
            .parse()
            .unwrap();

        let contract_request = ContractRequestSchema {
            loan_id: loan_offer.id,
            // TODO: This loan amount can cause the collateral to be over the Mutinynet faucet limit
            // if the real price of Bitcoin changes enough. We should mock the price in
            // the `hub` for the e2e tests.
            loan_amount: dec!(2_000),
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

        // TODO: Ensure that we don't need to calculate this again in the client (and in the tests).
        let total_collateral = {
            let initial_price = contract.loan_amount
                / (contract.initial_ltv
                    * Decimal::try_from(Amount::from_sat(contract.collateral_sats).to_btc())
                        .unwrap());

            let origination_fee = (contract.loan_amount / initial_price)
                * Decimal::try_from(ORIGINATION_FEE_RATE).unwrap();
            let origination_fee =
                Amount::from_btc(origination_fee.round_dp(8).to_f64().unwrap()).unwrap();

            contract.collateral_sats + origination_fee.to_sat()
        };

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

            let res = faucet
                .post("https://faucet.mutinynet.com/api/onchain")
                .json(&json!({
                    "sats": total_collateral,
                    "address": contract_address
                }))
                .send()
                .await
                .unwrap();

            let status = res.status();

            assert!(status.is_success());
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
        // TODO: 7. Borrower confirms payment.

        // 8. Repay loan on loan blockchain.
        let res = lender
            .put(format!(
                "http://localhost:7338/api/contracts/{}/repaid",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        // 9. Claim collateral on Bitcoin.
        // With DLCs, we will need to construct a spend transaction using the loan secret.

        let res = borrower
            .get(format!(
                "http://localhost:7337/api/contracts/{}/claim",
                contract.id
            ))
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let ClaimCollateralPsbt {
            psbt: claim_psbt,
            collateral_descriptor,
        } = res.json().await.unwrap();

        let claim_psbt = hex::decode(claim_psbt).unwrap();
        let claim_psbt = Psbt::deserialize(&claim_psbt).unwrap();

        let tx = borrower_wallet::wallet::sign_claim_psbt(
            claim_psbt,
            collateral_descriptor,
            borrower_wallet_index,
        )
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
