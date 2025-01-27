use crate::config::Config;
use crate::model::Borrower;
use crate::model::Contract;
use crate::model::Lender;
use rust_decimal::Decimal;

mod email;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Failed sending email. {0}")]
    Email(anyhow::Error),
}

pub struct Notifications {
    email: email::Email,
}

impl Notifications {
    pub fn new(config: Config) -> Self {
        Self {
            email: email::Email::new(config),
        }
    }

    pub async fn send_verification_code(
        &self,
        name: &str,
        email: &str,
        url: &str,
        code: &str,
    ) -> Result<(), Error> {
        self.email
            .send_verification_code(name, email, url, code)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_password_reset_token(
        &self,
        name: &str,
        email: &str,
        token_expiry_minutes: i64,
        url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_password_reset_token(name, email, token_expiry_minutes, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_start_dispute(
        &self,
        name: &str,
        email: &str,
        dispute_id: &str,
    ) -> Result<(), Error> {
        self.email
            .send_start_dispute(name, email, dispute_id)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_notify_admin_about_dispute(
        &self,
        user: Borrower,
        dispute_id: &str,
        lender_id: &str,
        borrower_id: &str,
        contract_id: &str,
    ) -> Result<(), Error> {
        self.email
            .send_notify_admin_about_dispute(user, dispute_id, lender_id, borrower_id, contract_id)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_user_about_margin_call(
        &self,
        user: Borrower,
        contract: Contract,
        price: Decimal,
        current_ltv: Decimal,
        contract_url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_user_about_margin_call(user, contract, price, current_ltv, contract_url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_liquidation_notice_borrower(
        &self,
        borrower: Borrower,
        contract: Contract,
        price: Decimal,
        contract_url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_liquidation_notice_borrower(borrower, contract, price, contract_url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_liquidation_notice_lender(
        &self,
        lender: Lender,
        contract: Contract,
        contract_url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_liquidation_notice_lender(lender, contract, contract_url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_new_loan_request(&self, lender: Lender, url: &str) -> Result<(), Error> {
        self.email
            .send_new_loan_request(lender, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_request_approved(
        &self,
        borrower: Borrower,
        url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_loan_request_approved(borrower, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_notification_about_auto_accepted_loan(
        &self,
        lender: Lender,
        url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_notification_about_auto_accepted_loan(lender, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_request_rejected(
        &self,
        borrower: Borrower,
        url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_loan_request_rejected(borrower, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_collateralized(&self, user: Lender, url: &str) -> Result<(), Error> {
        self.email
            .send_loan_collateralized(user, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_paid_out(&self, user: Borrower, url: &str) -> Result<(), Error> {
        self.email
            .send_loan_paid_out(user, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_close_to_expiry_contract(
        &self,
        user: Borrower,
        expiry_date: &str,
        url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_close_to_expiry_contract(user, expiry_date, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_moon_card_ready(&self, user: Borrower, url: &str) -> Result<(), Error> {
        self.email
            .send_moon_card_ready(user, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_repaid(&self, user: Lender, url: &str) -> Result<(), Error> {
        self.email
            .send_loan_repaid(user, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_liquidated_after_default(
        &self,
        user: Borrower,
        url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_loan_liquidated_after_default(user, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_defaulted_lender(&self, user: Lender, url: &str) -> Result<(), Error> {
        self.email
            .send_loan_defaulted_lender(user, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }

    pub async fn send_loan_defaulted_borrower(
        &self,
        user: Borrower,
        url: &str,
    ) -> Result<(), Error> {
        self.email
            .send_loan_defaulted_borrower(user, url)
            .await
            .map_err(Error::Email)?;
        Ok(())
    }
}
