#![allow(clippy::unwrap_used)]

use crate::common::init_tracing;
use crate::common::log_in;
use bitcoin::bip32;
use bitcoin::Address;
use bitcoin::PublicKey;
use hub::model;
use hub::model::CreateLoanApplicationSchema;
use hub::model::LoanAsset;
use hub::model::LoanType;
use hub::model::RepaymentPlan;
use rust_decimal_macros::dec;
use serde::Deserialize;
use serde::Serialize;
use std::str::FromStr;
use uuid::Uuid;

pub mod common;

/// Run `just prepare-e2e` before this test.
#[ignore]
#[tokio::test]
async fn borrower_loan_applications() {
    let env_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let env_path = format!("{env_dir}/../.env");
    dotenv::from_filename(env_path).ok();

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

    // 1. Borrower creates loan application, i.e. a request for a loan.

    // This data is not necessarily correct. If the test is extended all this should come from the
    // wallet.
    let borrower_pk = "02f9b7d3cc922648d43c81f7859d55c2b1649eabb5bdbf075b4c1fd7afbe73b657"
        .parse()
        .unwrap();
    let borrower_derivation_path = "586/1/0".parse().unwrap();
    let borrower_npub = "npub17mx98j4khcynw7cm6m0zfu5q2uv6dqs2lenaq8nfzn8paz5dt4hqs5utwq"
        .parse()
        .unwrap();

    let loan_application = CreateLoanApplicationSchema {
        ltv: dec!(0.5),
        interest_rate: dec!(0.12),
        loan_amount: dec!(123),
        duration_days: 180,
        loan_asset: LoanAsset::UsdcPol,
        loan_type: LoanType::StableCoin,
        borrower_loan_address: Some(
            "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3".to_string(),
        ),
        borrower_btc_address: Address::from_str("tb1q0la2pwu7l4raleuna064622grkwydnztu7ax9k")
            .expect("to be valid"),
        borrower_pk,
        borrower_derivation_path,
        borrower_npub,
        client_contract_id: Some(Uuid::new_v4()),
        repayment_plan: RepaymentPlan::Bullet,
    };

    let res = borrower
        .post("http://localhost:7337/api/loan-applications")
        .json(&loan_application)
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success(), "{:?}", res.text().await);

    let loan_application: model::LoanApplication = res.json().await.unwrap();

    let res = lender
        .get("http://localhost:7338/api/loan-applications")
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success(), "{:?}", res.text().await);

    let loan_applications: Vec<LoanApplication> = res.json().await.unwrap();

    assert!(loan_applications
        .iter()
        .any(|application| application.id == loan_application.loan_deal_id));

    let id = loan_application.loan_deal_id;

    let res = lender
        .post(format!("http://localhost:7338/api/loan-applications/{id}"))
        .json(&TakeLoanApplicationSchema {
            lender_pk: "0243db39299918f1084f4c42216c3053cff4e3a37a863d39033a78c229b3884572"
                .parse()
                .unwrap(),
            lender_derivation_path: "586/1/0".parse().unwrap(),
            loan_repayment_address: "just_some_random_address".to_string(),
            lender_npub: "npub1w8yt6gww5cjlhqam95rq8nemk8lmceswj395sf7fzlpvdxve3uysy24gxg"
                .to_string(),
        })
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success(), "{:?}", res.text().await);
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoanApplication {
    pub id: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TakeLoanApplicationSchema {
    pub lender_pk: PublicKey,
    pub lender_derivation_path: bip32::DerivationPath,
    pub loan_repayment_address: String,
    pub lender_npub: String,
}
