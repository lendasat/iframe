pub mod logger;

#[cfg(test)]
mod tests {
    use hub::model::CreateLoanOfferSchema;
    use hub::model::LoanAssetChain::Ethereum;
    use hub::model::LoanAssetType;
    use hub::model::LoanOffer;
    use hub::model::LoginUserSchema;
    use reqwest::cookie::Jar;
    use reqwest::Client;
    use rust_decimal_macros::dec;
    use std::sync::Arc;

    #[tokio::test]
    async fn open_loan() {
        // Assume the borrower and lender are already registered via `just register-test-subjects`

        // 0. Log in borrower and lender.
        let borrower_cookie_jar = Arc::new(Jar::default());
        let borrower = Client::builder()
            .cookie_provider(borrower_cookie_jar)
            .build()
            .unwrap();

        let borrower_login = LoginUserSchema {
            email: "bob_the_borrower@lendasat.com".to_string(),
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
            email: "alice_the_lender@lendasat.com".to_string(),
            password: "123password".to_string(),
        };

        let res = lender
            .post("http://localhost:7338/api/auth/login")
            .json(&lender_login)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        // 1. Lender creates loan offer http://localhost:7338/api/offers/create
        let loan_offer = CreateLoanOfferSchema {
            name: "a fantastic loan".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(10.0),
            loan_amount_min: dec!(10000.0),
            loan_amount_max: dec!(50000.0),
            duration_months_min: 1,
            duration_months_max: 12,
            loan_asset_type: LoanAssetType::Usdc,
            loan_asset_chain: Ethereum,
        };

        let res = lender
            .post("http://localhost:7338/api/offers/create")
            .json(&loan_offer)
            .send()
            .await
            .unwrap();

        assert!(res.status().is_success());

        let res = lender
            .get("http://localhost:7338/api/offers")
            .send()
            .await
            .unwrap();

        let loan_offers: Vec<LoanOffer> = res.json().await.unwrap();

        dbg!(&loan_offers);

        // client.post("localhost:7338/api/offers/create").build();

        //    Lender must have provided repayment address.
        // 2. Borrower takes loan offer, creates contract request Borrower includes:
        //      - Payout address (external wallet).
        //      - Public key for the multisig (deterministically derived from seed).
        // 3. Lender accepts contract request
        // 4. Borrower pays to collateral address Lots of things (in the final protocol).
        // 5. Hub sees collateral funding TX
        // 6. Hub tells lender to send principal to borrower on Ethereum
        // 7. Borrower confirms payment
    }
}
