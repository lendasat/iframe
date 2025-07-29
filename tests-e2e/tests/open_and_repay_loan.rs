#![allow(clippy::unwrap_used)]

use crate::common::init_tracing;
use crate::common::log_in;
use crate::common::new_wallet;
use crate::common::random_txid;
use crate::common::wait_until_contract_status;
use crate::common::LoanOffer;
use bitcoin::Psbt;
use hub::model::ConfirmInstallmentPaymentRequest;
use hub::model::ContractRequestSchema;
use hub::model::ContractStatus;
use hub::model::CreateLoanOfferSchema;
use hub::model::InstallmentPaidRequest;
use hub::model::LoanAsset;
use hub::model::LoanPayout;
use hub::model::LoanType;
use hub::model::RepaymentPlan;
use hub::model::ONE_YEAR;
use hub::routes::borrower::ClaimCollateralPsbt;
use hub::routes::borrower::ClaimTx;
use hub::routes::borrower::Contract;
use reqwest::Client;
use rust_decimal_macros::dec;
use serde_json::json;

pub mod common;

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

    let mut lender_wallet = new_wallet(
        "gaze smile arm manual remember session endorse ask mention goose demise garlic",
        &network,
    );

    let (lender_pk, lender_derivation_path) = lender_wallet.next_hardened_pk().unwrap();

    let loan_offer = CreateLoanOfferSchema {
        name: "a fantastic loan".to_string(),
        min_ltv: dec!(0.5),
        interest_rate: dec!(0.10),
        loan_amount_min: dec!(500),
        loan_amount_max: dec!(50_000),
        loan_amount_reserve: dec!(50_000),
        duration_days_min: 7,
        duration_days_max: ONE_YEAR as i32,
        loan_asset: LoanAsset::UsdcEth,
        loan_payout: LoanPayout::Direct,
        loan_repayment_address:
            "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
        lender_pk,
        lender_derivation_path,
        auto_accept: false,
        kyc_link: None,
        lender_npub: "npub1ur9aupjyaettv9rlan886m3khq7ysw3jl902afrkjg2r80uxdcnsmgu6rv"
            .parse()
            .unwrap(),
        extension_duration_days: Some(7),
        extension_interest_rate: Some(dec!(0.12)),
        repayment_plan: RepaymentPlan::Bullet,
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
    let mut borrower_wallet = new_wallet(
        "ribbon remain host witness hawk lesson genius duck route social need juice",
        &network,
    );

    let (borrower_pk, borrower_derivation_path) = borrower_wallet.next_hardened_pk().unwrap();

    let borrower_btc_address = "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37"
        .parse()
        .unwrap();

    let contract_request = ContractRequestSchema {
        id: loan_offer.id,
        loan_amount: dec!(500),
        duration_days: 7,
        borrower_btc_address,
        borrower_pk,
        borrower_derivation_path,
        borrower_loan_address: Some(
            "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
        ),
        loan_type: LoanType::StableCoin,
        moon_card_id: None,
        fiat_loan_details: None,
        borrower_npub: Some(
            "npub1x4n3a7ld36fluzzanfg2jm4p7tzpxqp0s47xc8rcpjk4adlkz0qstg4xrp"
                .parse()
                .unwrap(),
        ),
        client_contract_id: None,
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
        let half = total_collateral.div_ceil(2);
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
            "http://localhost:7338/api/contracts/{}/report-disbursement?txid={loan_txid}",
            contract.id
        ))
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success());

    // 8. Repay loan on loan blockchain.

    // Single installment for a bullet loan.
    let installment_id = contract.installments[0].id;

    let repayment_txid = random_txid();
    let res = borrower
        .put(format!(
            "http://localhost:7337/api/contracts/{}/installment-paid",
            contract.id
        ))
        .json(&InstallmentPaidRequest {
            installment_id,
            payment_id: repayment_txid.to_string(),
        })
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success());

    let res = lender
        .put(format!(
            "http://localhost:7338/api/contracts/{}/confirm-installment",
            contract.id
        ))
        .json(&ConfirmInstallmentPaymentRequest { installment_id })
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

    let tx = borrower_wallet
        .sign_spend_collateral_psbt(
            claim_psbt,
            collateral_descriptor,
            borrower_pk,
            contract.borrower_derivation_path.as_ref(),
        )
        .unwrap();

    let tx_hex = bitcoin::consensus::encode::serialize_hex(&tx);

    let res = borrower
        .post(format!(
            "http://localhost:7337/api/contracts/{}/broadcast-claim",
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
