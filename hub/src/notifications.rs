use crate::config::Config;
use crate::model::Borrower;
use crate::model::Contract;
use crate::model::Lender;
use crate::telegram_bot::TelegramBot;
use rust_decimal::Decimal;
use url::Url;
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

    pub async fn send_verification_code(&self, name: &str, email: &str, url: Url, code: &str) {
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
        url: Url,
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

    pub async fn send_borrower_margin_call(
        &self,
        borrower: Borrower,
        contract: Contract,
        price: Decimal,
        current_ltv: Decimal,
        contract_url: Url,
    ) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::MarginCall,
        )
        .await;

        if let Err(e) = self
            .email
            .send_user_about_margin_call(borrower, contract, price, current_ltv, contract_url)
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
        contract_url: Url,
    ) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LiquidationNotice,
        )
        .await;

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
        contract_url: Url,
    ) {
        self.send_tg_notification_lender(
            &lender,
            contract_url.clone(),
            crate::telegram_bot::LenderNotificationKind::LiquidationNotice,
        )
        .await;

        if let Err(e) = self
            .email
            .send_liquidation_notice_lender(lender, contract, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_new_loan_request(&self, lender: Lender, url: Url) {
        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::NewLoanRequest,
        )
        .await;

        if let Err(e) = self.email.send_new_loan_request(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_request_approved(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::RequestApproved,
        )
        .await;

        if let Err(e) = self
            .email
            .send_loan_request_approved(borrower, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_notification_about_auto_accepted_loan(&self, lender: Lender, url: Url) {
        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::RequestAutoApproved,
        )
        .await;

        if let Err(e) = self
            .email
            .send_notification_about_auto_accepted_loan(lender, url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_request_rejected(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::RequestRejected,
        )
        .await;

        if let Err(e) = self
            .email
            .send_loan_request_rejected(borrower, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_collateralized(&self, lender: Lender, url: Url) {
        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::Collateralized,
        )
        .await;

        if let Err(e) = self.email.send_loan_collateralized(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_paid_out(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LoanPaidOut,
        )
        .await;

        if let Err(e) = self.email.send_loan_paid_out(borrower, contract_url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_close_to_expiry_contract(
        &self,
        borrower: Borrower,
        expiry_date: &str,
        contract_url: Url,
    ) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::CloseToExpiry,
        )
        .await;

        if let Err(e) = self
            .email
            .send_close_to_expiry_contract(borrower, expiry_date, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_moon_card_ready(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::MoonCardReady,
        )
        .await;

        if let Err(e) = self
            .email
            .send_moon_card_ready(borrower, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_repaid(&self, lender: Lender, url: Url) {
        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::Repaid,
        )
        .await;

        if let Err(e) = self.email.send_loan_repaid(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_liquidated_after_default(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LiquidatedAfterDefault,
        )
        .await;

        if let Err(e) = self
            .email
            .send_loan_liquidated_after_default(borrower, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_defaulted_lender(&self, lender: Lender, url: Url) {
        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::Defaulted,
        )
        .await;

        if let Err(e) = self.email.send_loan_defaulted_lender(lender, url).await {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_loan_defaulted_borrower(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LoanDefaulted,
        )
        .await;

        if let Err(e) = self
            .email
            .send_loan_defaulted_borrower(borrower, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_expired_loan_request_borrower(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LoanRequestExpired,
        )
        .await;

        if let Err(e) = self
            .email
            .send_expired_loan_request_borrower(borrower, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }
    pub async fn send_expired_loan_request_lender(&self, lender: Lender, url: Url) {
        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::RequestExpired,
        )
        .await;

        if let Err(e) = self
            .email
            .send_expired_loan_request_lender(lender, url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    pub async fn send_chat_notification_lender(&self, lender: Lender, contract_url: Url) {
        self.send_tg_notification_lender(
            &lender,
            contract_url.clone(),
            crate::telegram_bot::LenderNotificationKind::NewChatMessage {
                name: lender.name.clone(),
            },
        )
        .await;
        if let Err(e) = self
            .email
            .send_new_chat_message_notification_lender(lender, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }
    pub async fn send_chat_notification_borrower(&self, borrower: Borrower, contract_url: Url) {
        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::NewChatMessage {
                name: borrower.name.clone(),
            },
        )
        .await;

        if let Err(e) = self
            .email
            .send_new_chat_message_notification_borrower(borrower, contract_url)
            .await
        {
            tracing::error!("Could not send email {e:#}");
        }
    }

    async fn send_tg_notification_lender(
        &self,
        lender: &Lender,
        url: Url,
        kind: crate::telegram_bot::LenderNotificationKind,
    ) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    user_id: lender.id.clone(),
                    url,
                    kind: crate::telegram_bot::NotificationTarget::Lender(kind),
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }
    }

    async fn send_tg_notification_borrower(
        &self,
        borrower: &Borrower,
        contract_url: Url,
        kind: crate::telegram_bot::BorrowerNotificationKind,
    ) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    user_id: borrower.id.clone(),
                    url: contract_url,
                    kind: crate::telegram_bot::NotificationTarget::Borrower(kind),
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }
    }
}
