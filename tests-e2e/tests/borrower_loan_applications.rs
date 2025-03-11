#![allow(clippy::unwrap_used)]

use crate::common::init_tracing;
use crate::common::log_in;
use bitcoin::bip32::Xpub;
use bitcoin::Address;
use hub::model;
use hub::model::CreateLoanApplicationSchema;
use hub::model::LoanAsset;
use hub::model::LoanType;
use rust_decimal_macros::dec;
use serde::Deserialize;
use serde::Serialize;
use std::str::FromStr;

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
    let borrower_xpub = "tpubD6NzVbkrYhZ4Yon2URjspXp7Y7DKaBaX1ZVMCEnhc8zCrj1AuJyLrhmAKFmnkqVULW6znfEMLvgukHBVJD4fukpVYre3dpHXmkbcpvtviro".parse().unwrap();
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
        borrower_xpub,
    };

    let res = borrower
        .post("http://localhost:7337/api/loans/application")
        .json(&loan_application)
        .send()
        .await
        .unwrap();

    assert!(res.status().is_success(), "{:?}", res.text().await);

    let loan_application: model::LoanApplication = res.json().await.unwrap();

    let res = lender
        .get("http://localhost:7338/api/loans/application")
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
        .post(format!("http://localhost:7338/api/loans/application/{id}"))
        .json(&TakeLoanApplicationSchema {
            lender_xpub: Xpub::from_str("tpubD6NzVbkrYhZ4Y8GthGPHWfMvNi3rs8F1ZDjyvmiB9qq4K1AsBDh2yaRznuHvuFNQEyXFFKxEYtUXTJB5cos9zJpjXU3sywyXVGTZMD8tzsh").expect("to be valid"),
            loan_repayment_address: "just_some_random_address".to_string(),
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
    pub lender_xpub: Xpub,
    pub loan_repayment_address: String,
}
