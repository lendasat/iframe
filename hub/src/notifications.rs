use crate::config::Config;
use crate::model::Borrower;
use crate::model::Contract;
use crate::model::Lender;
use crate::telegram_bot::TelegramBot;
use rust_decimal::Decimal;
use xtra::Address;

mod email;

pub struct Notifications {
    email: email::Email,
    telegram_bot: Option<Address<TelegramBot>>,
}

impl Notifications {
    pub fn new(config: Config, maybe_telegram_bot: Option<Address<TelegramBot>>) -> Self {
        Self {
            email: email::Email::new(config),
            telegram_bot: maybe_telegram_bot,
        }
    }

    pub async fn send_verification_code(&self, name: &str, email: &str, url: &str, code: &str) {
        if let Err(e) = self
            .email
            .send_verification_code(name, email, url, code)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_password_reset_token(
        &self,
        name: &str,
        email: &str,
        token_expiry_minutes: i64,
        url: &str,
    ) {
        if let Err(e) = self
            .email
            .send_password_reset_token(name, email, token_expiry_minutes, url)
            .await
        {
            {
                tracing::error!("Could not send email {e:#}");
            }
        }
    }

    pub async fn send_start_dispute(&self, name: &str, email: &str, dispute_id: &str) {
        if let Err(e) = self.email.send_start_dispute(name, email, dispute_id).await {
            {
                tracing::error!("Could not send email {e:#}");
            }
        }
    }

    pub async fn send_notify_admin_about_dispute(
        &self,
        user: Borrower,
        dispute_id: &str,
        lender_id: &str,
        borrower_id: &str,
        contract_id: &str,
    ) {
        if let Err(e) = self
            .email
            .send_notify_admin_about_dispute(user, dispute_id, lender_id, borrower_id, contract_id)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_user_about_margin_call(
        &self,
        user: Borrower,
        contract: Contract,
        price: Decimal,
        current_ltv: Decimal,
        contract_url: &str,
    ) {
        if let Err(e) = self
            .email
            .send_user_about_margin_call(user, contract, price, current_ltv, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_liquidation_notice_borrower(
        &self,
        borrower: Borrower,
        contract: Contract,
        price: Decimal,
        contract_url: &str,
    ) {
        if let Err(e) = self
            .email
            .send_liquidation_notice_borrower(borrower, contract, price, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_liquidation_notice_lender(
        &self,
        lender: Lender,
        contract: Contract,
        contract_url: &str,
    ) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    lender_id: lender.id.clone(),
                    url: contract_url.to_string(),
                    kind: crate::telegram_bot::NotificationKind::LiquidationNotice,
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }

        if let Err(e) = self
            .email
            .send_liquidation_notice_lender(lender, contract, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_new_loan_request(&self, lender: Lender, url: &str) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    lender_id: lender.id.clone(),
                    url: url.to_string(),
                    kind: crate::telegram_bot::NotificationKind::NewLoanRequest,
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }

        if let Err(e) = self.email.send_new_loan_request(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_request_approved(&self, borrower: Borrower, url: &str) {
        if let Err(e) = self.email.send_loan_request_approved(borrower, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_notification_about_auto_accepted_loan(&self, lender: Lender, url: &str) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    lender_id: lender.id.clone(),
                    url: url.to_string(),
                    kind: crate::telegram_bot::NotificationKind::RequestAutoApproved,
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }

        if let Err(e) = self
            .email
            .send_notification_about_auto_accepted_loan(lender, url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_request_rejected(&self, borrower: Borrower, url: &str) {
        if let Err(e) = self.email.send_loan_request_rejected(borrower, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_collateralized(&self, lender: Lender, url: &str) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    lender_id: lender.id.clone(),
                    url: url.to_string(),
                    kind: crate::telegram_bot::NotificationKind::Collateralized,
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }

        if let Err(e) = self.email.send_loan_collateralized(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_paid_out(&self, user: Borrower, url: &str) {
        if let Err(e) = self.email.send_loan_paid_out(user, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_close_to_expiry_contract(
        &self,
        user: Borrower,
        expiry_date: &str,
        url: &str,
    ) {
        if let Err(e) = self
            .email
            .send_close_to_expiry_contract(user, expiry_date, url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_moon_card_ready(&self, user: Borrower, url: &str) {
        if let Err(e) = self.email.send_moon_card_ready(user, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_repaid(&self, lender: Lender, url: &str) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    lender_id: lender.id.clone(),
                    url: url.to_string(),
                    kind: crate::telegram_bot::NotificationKind::Repaid,
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }

        if let Err(e) = self.email.send_loan_repaid(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_liquidated_after_default(&self, user: Borrower, url: &str) {
        if let Err(e) = self
            .email
            .send_loan_liquidated_after_default(user, url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_defaulted_lender(&self, lender: Lender, url: &str) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    lender_id: lender.id.clone(),
                    url: url.to_string(),
                    kind: crate::telegram_bot::NotificationKind::Defaulted,
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }

        if let Err(e) = self.email.send_loan_defaulted_lender(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_defaulted_borrower(&self, user: Borrower, url: &str) {
        if let Err(e) = self.email.send_loan_defaulted_borrower(user, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }
}
