#![allow(clippy::unwrap_used)]

use crate::common::init_tracing;
use crate::common::log_in;
use crate::common::new_wallet;
use crate::common::random_txid;
use crate::common::wait_until_contract_status;
use crate::common::LoanOffer;
use crate::common::PaginatedContractsResponse;
use bitcoin::Psbt;
use hub::model::ConfirmInstallmentPaymentRequest;
use hub::model::ContractRequestSchema;
use hub::model::ContractStatus;
use hub::model::CreateLoanOfferSchema;
use hub::model::LoanAsset;
use hub::model::LoanPayout;
use hub::model::LoanType;
use hub::model::RepaymentPlan;
use hub::model::ONE_YEAR;
use hub::routes::borrower::ClaimTx;
use hub::routes::borrower::Contract;
use hub::routes::borrower::GenerateBitcoinInvoiceResponse;
use hub::routes::borrower::ReportBitcoinPaymentRequest;
use hub::routes::borrower::SpendCollateralPsbt;
use reqwest::Client;
use rust_decimal_macros::dec;

pub mod common;

/// Run `just prepare-e2e` before this test.
///
/// This test verifies the complete Bitcoin repayment flow.
#[ignore]
#[tokio::test]
async fn bitcoin_repayment_flow() {
    let network = "regtest";

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

    // 1. Lender creates a USD-based loan offer with Bitcoin repayment address.

    let mut lender_wallet = new_wallet(
        "gaze smile arm manual remember session endorse ask mention goose demise garlic",
        network,
    );

    let (lender_pk, lender_derivation_path) = lender_wallet.next_hardened_pk().unwrap();

    let btc_loan_repayment_address = "bcrt1qz03p9vws34kncrvdknafa05pvj4dz0rlmsfqw8"
        .parse()
        .unwrap();

    let loan_offer = CreateLoanOfferSchema {
        name: "USD loan with Bitcoin repayment".to_string(),
        min_ltv: dec!(0.5),
        interest_rate: dec!(0.10),
        loan_amount_min: dec!(100),
        loan_amount_max: dec!(10_000),
        duration_days_min: 7,
        duration_days_max: ONE_YEAR as i32,
        loan_asset: LoanAsset::UsdcPol, // USD-based loan for Bitcoin repayment support
        loan_payout: LoanPayout::Direct,
        loan_repayment_address:
            "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
        btc_loan_repayment_address: Some(btc_loan_repayment_address),
        lender_pk,
        lender_derivation_path,
        auto_accept: false,
        kyc_link: None,
        lender_npub: "npub1ur9aupjyaettv9rlan886m3khq7ysw3jl902afrkjg2r80uxdcnsmgu6rv"
            .parse()
            .unwrap(),
        extension_duration_days: None,
        extension_interest_rate: None,
        repayment_plan: RepaymentPlan::Bullet,
    };

    let res = lender
        .post("http://localhost:7338/api/offers/create")
        .json(&loan_offer)
        .send()
        .await
        .unwrap();

    assert_response!(res);

    let loan_offer: LoanOffer = res.json().await.unwrap();

    // 2. Borrower takes loan offer by creating a contract request.
    let mut borrower_wallet = new_wallet(
        "ribbon remain host witness hawk lesson genius duck route social need juice",
        network,
    );

    let (borrower_pk, borrower_derivation_path) = borrower_wallet.next_hardened_pk().unwrap();

    let borrower_btc_address = "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37"
        .parse()
        .unwrap();

    let contract_request = ContractRequestSchema {
        id: loan_offer.id,
        loan_amount: dec!(1_000), // $1000 loan
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

    assert_response!(res);

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

    assert_response!(res);

    // 4. Complete collateral setup

    let res = borrower
        .get("http://localhost:7337/api/contracts")
        .send()
        .await
        .unwrap();

    assert_response!(res);

    let response: PaginatedContractsResponse = res.json().await.unwrap();
    let contracts = response.data;

    let contract = contracts.iter().find(|c| c.id == contract.id).unwrap();

    let total_collateral = contract.initial_collateral_sats + contract.origination_fee_sats;

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

    assert_response!(res);

    let res = mempool
        .post("http://localhost:7339/mine/6")
        .send()
        .await
        .unwrap();

    assert_response!(res);

    wait_until_contract_status(
        &borrower,
        "localhost:7337",
        &contract.id,
        ContractStatus::CollateralConfirmed,
        network,
    )
    .await
    .unwrap();

    // 5. Lender confirms principal was disbursed.

    let loan_txid = random_txid();
    let res = lender
        .put(format!(
            "http://localhost:7338/api/contracts/{}/report-disbursement?txid={loan_txid}",
            contract.id
        ))
        .send()
        .await
        .unwrap();

    assert_response!(res);

    // 6. Generate BTC repayment invoice.

    let res = borrower
        .post(format!(
            "http://localhost:7337/api/contracts/{}/generate-btc-invoice",
            contract.id
        ))
        .send()
        .await
        .unwrap();

    assert_response!(res);

    let response: GenerateBitcoinInvoiceResponse = res.json().await.unwrap();
    let invoice = response.invoice;

    // 7. Report invoice payment (we don't actually need to make the payment because the hub is not
    // verifying this at this stage).

    let res = borrower
        .put(format!(
            "http://localhost:7337/api/contracts/{}/btc-invoice-paid",
            contract.id
        ))
        .json(&ReportBitcoinPaymentRequest {
            txid: random_txid(),
            invoice_id: invoice.id,
        })
        .send()
        .await
        .unwrap();

    assert_response!(res);

    // 8. Lender confirms installment payment.

    let res = lender
        .put(format!(
            "http://localhost:7338/api/contracts/{}/confirm-installment",
            contract.id
        ))
        .json(&ConfirmInstallmentPaymentRequest {
            installment_id: response.installment.id,
        })
        .send()
        .await
        .unwrap();

    assert_response!(res);

    // 9. Claim collateral on Bitcoin.

    let fee_rate = 1;
    let res = borrower
        .get(format!(
            "http://localhost:7337/api/contracts/{}/claim?fee_rate={fee_rate}",
            contract.id
        ))
        .send()
        .await
        .unwrap();

    assert_response!(res);

    let SpendCollateralPsbt {
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

    assert_response!(res);

    let mempool = Client::new();
    let res = mempool
        .post("http://localhost:7339/mine/2")
        .send()
        .await
        .unwrap();

    assert_response!(res);

    wait_until_contract_status(
        &borrower,
        "localhost:7337",
        &contract.id,
        ContractStatus::Closed,
        network,
    )
    .await
    .unwrap();
}
