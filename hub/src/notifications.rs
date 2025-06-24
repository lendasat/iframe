use crate::config::Config;
use crate::db;
use crate::model;
use crate::model::Borrower;
use crate::model::Contract;
use crate::model::Lender;
use crate::model::LoanAsset;
use crate::model::NotificationMessage;
use crate::notifications::websocket::NotificationCenter;
use crate::telegram_bot::TelegramBot;
use rust_decimal::Decimal;
use sqlx::PgPool;
use time::OffsetDateTime;
use url::Url;
use uuid::Uuid;
use xtra::Address;

mod email;
pub mod websocket;

pub struct Notifications {
    db: PgPool,
    email: email::Email,
    telegram_bot: Option<Address<TelegramBot>>,
    pub(crate) websocket: NotificationCenter,
}

impl Notifications {
    pub fn new(
        config: Config,
        maybe_telegram_bot: Option<Address<TelegramBot>>,
        center: NotificationCenter,
        db: PgPool,
    ) -> Self {
        Self {
            db,
            email: email::Email::new(config),
            telegram_bot: maybe_telegram_bot,
            websocket: center,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn send_login_information_borrower(
        &self,
        borrower: Borrower,
        profile_url: Url,
        ip_address: &str,
        login_time: OffsetDateTime,
        location: Option<String>,
        device: &str,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        if settings.on_login_email {
            if let Some(email) = borrower.email.as_ref() {
                if let Err(e) = self
                    .email
                    .send_login_information(
                        borrower.name.as_str(),
                        email,
                        profile_url.clone(),
                        ip_address,
                        login_time,
                        location,
                        device,
                    )
                    .await
                {
                    tracing::error!("Could not send information about new login {e:#}");
                }
            }
        }
        if settings.on_login_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                profile_url,
                crate::telegram_bot::BorrowerNotificationKind::LoginNotification {
                    name: borrower.name.clone(),
                    ip_address: ip_address.to_string(),
                    login_time,
                },
            )
            .await;
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn send_login_information_lender(
        &self,
        lender: &Lender,
        profile_url: Url,
        ip_address: &str,
        login_time: OffsetDateTime,
        location: Option<String>,
        device: &str,
    ) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        if settings.on_login_email {
            if let Err(e) = self
                .email
                .send_login_information(
                    lender.name.as_str(),
                    lender.email.as_str(),
                    profile_url.clone(),
                    ip_address,
                    login_time,
                    location,
                    device,
                )
                .await
            {
                tracing::error!("Could not send information about new login {e:#}");
            }
        }
        if settings.on_login_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                profile_url,
                crate::telegram_bot::LenderNotificationKind::LoginNotification {
                    name: lender.name.clone(),
                    ip_address: ip_address.to_string(),
                    login_time,
                },
            )
            .await;
        }
    }

    pub async fn send_verification_code(&self, name: &str, email: &str, url: Url, code: &str) {
        if let Err(e) = self
            .email
            .send_verification_code(name, email, url, code)
            .await
        {
            tracing::error!("Could not send verification code {e:#}");
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
                tracing::error!("Could not send reset password token {e:#}");
            }
        }
    }

    pub async fn send_start_dispute(&self, name: &str, email: &str, contract_id: &str) {
        if let Err(e) = self
            .email
            .send_start_dispute(name, email, contract_id)
            .await
        {
            {
                tracing::error!("Could not send email to start dispute {e:#}");
            }
        }
    }

    pub async fn send_notify_admin_about_dispute_borrower(
        &self,
        user: Borrower,
        dispute_id: &str,
        lender_id: &str,
        borrower_id: &str,
        contract_id: &str,
    ) {
        if let Err(e) = self
            .email
            .send_notify_admin_about_dispute(
                user.name.as_str(),
                dispute_id,
                lender_id,
                borrower_id,
                contract_id,
            )
            .await
        {
            tracing::error!("Could not send notification about dispute {e:#}");
        }
    }

    pub async fn send_notify_admin_about_dispute_lender(
        &self,
        user: Lender,
        dispute_id: &str,
        lender_id: &str,
        borrower_id: &str,
        contract_id: &str,
    ) {
        if let Err(e) = self
            .email
            .send_notify_admin_about_dispute(
                user.name.as_str(),
                dispute_id,
                lender_id,
                borrower_id,
                contract_id,
            )
            .await
        {
            tracing::error!("Could not send notification about dispute {e:#}");
        }
    }

    pub async fn send_borrower_margin_call(
        &self,
        borrower: Borrower,
        contract: Contract,
        price: Decimal,
        current_ltv: Decimal,
        liquidation_price: Decimal,
        contract_url: Url,
    ) {
        // TODO: introduce margin call events

        self.send_tg_notification_borrower(
            borrower.id.as_str(),
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::MarginCall,
        )
        .await;

        if let Err(e) = self
            .email
            .send_user_about_margin_call(
                borrower,
                contract,
                price,
                current_ltv,
                liquidation_price,
                contract_url,
            )
            .await
        {
            tracing::error!("Could not send margin call notification borrower {e:#}");
        }
    }

    pub async fn send_liquidation_notice_borrower(
        &self,
        borrower: Borrower,
        contract: Contract,
        price: Decimal,
        liquidation_price: Decimal,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            contract.id.as_str(),
            borrower.id.as_str(),
            model::db::ContractStatus::Undercollateralized,
        )
        .await;

        self.send_tg_notification_borrower(
            borrower.id.as_str(),
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LiquidationNotice,
        )
        .await;

        if let Err(e) = self
            .email
            .send_liquidation_notice_borrower(
                borrower,
                contract,
                price,
                liquidation_price,
                contract_url,
            )
            .await
        {
            tracing::error!("Could not send tg notification borrower {e:#}");
        }
    }

    pub async fn send_liquidation_notice_lender(
        &self,
        lender: Lender,
        contract: Contract,
        contract_url: Url,
    ) {
        self.notify_lender_frontend_contract_status(
            contract.id.as_str(),
            lender.id.as_str(),
            model::db::ContractStatus::Undercollateralized,
        )
        .await;

        self.send_tg_notification_lender(
            lender.id.as_str(),
            contract_url.clone(),
            crate::telegram_bot::LenderNotificationKind::LiquidationNotice,
        )
        .await;

        if let Err(e) = self
            .email
            .send_liquidation_notice_lender(&lender, contract, contract_url)
            .await
        {
            tracing::error!("Could not send liquidation notice lender {e:#}");
        }
    }

    pub async fn send_new_loan_request(&self, lender: Lender, url: Url, contract_id: &str) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        self.notify_lender_frontend_contract_status(
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::Requested,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                url.clone(),
                crate::telegram_bot::LenderNotificationKind::NewLoanRequest,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_new_loan_request(&lender, url, contract_id)
                .await
            {
                tracing::error!("Could not send new loan request {e:#}");
            }
        }

        if let Err(e) = db::contract_emails::mark_loan_request_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark loan-request email as sent: {e:#}");
        }
    }

    pub async fn send_loan_request_approved(
        &self,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_contract_status(
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::Approved,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::RequestApproved,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_loan_request_approved(borrower, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send loan request approved {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_loan_request_approved_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark loan-request-approved email as sent: {e:#}");
        }
    }

    pub async fn send_notification_about_auto_accepted_loan(
        &self,
        lender: Lender,
        url: Url,
        contract_id: &str,
    ) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        self.notify_lender_frontend_contract_status(
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::Approved,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                url.clone(),
                crate::telegram_bot::LenderNotificationKind::RequestAutoApproved,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_notification_about_auto_accepted_loan(&lender, url, contract_id)
                .await
            {
                tracing::error!("Could not send auto accept notification {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_auto_accept_email_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark auto-accept email as sent: {e:#}");
        }
    }

    pub async fn send_loan_request_rejected(
        &self,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_contract_status(
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::Rejected,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::RequestRejected,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_loan_request_rejected(borrower, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send request rejected {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_loan_request_rejected_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark loan-request-rejected email as sent: {e:#}");
        }
    }

    pub async fn send_loan_collateralized(&self, lender: Lender, url: Url, contract_id: &str) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        self.notify_lender_frontend_contract_status(
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::CollateralConfirmed,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                url.clone(),
                crate::telegram_bot::LenderNotificationKind::Collateralized,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_loan_collateralized(&lender, url, contract_id)
                .await
            {
                tracing::error!("Could not send loan collateralized {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_collateral_funded_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark collateral-funded email as sent: {e:#}");
        }
    }

    pub async fn send_loan_paid_out(
        &self,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_contract_status(
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::PrincipalGiven,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::LoanPaidOut,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_loan_paid_out(borrower, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send loan paid out {e:#}");
            }
        }

        if let Err(e) = db::contract_emails::mark_loan_paid_out_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark loan-paid-out email as sent: {e:#}");
        }
    }

    pub async fn send_installment_due_soon(
        &self,
        contract_id: &str,
        installment_id: Uuid,
        borrower: Borrower,
        expiry_date: &str,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_installment(
            contract_id,
            borrower.id.as_str(),
            installment_id,
            model::InstallmentStatus::Pending,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::InstallmentDueSoon,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_installment_due_soon(borrower, expiry_date, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send installment due soon: {e:#}");
            }
        }
    }

    pub async fn send_moon_card_ready(&self, borrower: Borrower, contract_url: Url) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::MoonCardReady,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_moon_card_ready(borrower, contract_url)
                .await
            {
                tracing::error!("Could not send moon card ready {e:#}");
            }
        }
    }

    pub async fn send_installment_paid(
        &self,
        lender: Lender,
        url: Url,
        installment_id: Uuid,
        contract_id: &str,
    ) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        self.notify_lender_frontend_installment(
            contract_id,
            lender.id.as_str(),
            installment_id,
            model::InstallmentStatus::Paid,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                url.clone(),
                crate::telegram_bot::LenderNotificationKind::InstallmentPaid,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_installment_paid(&lender, url, contract_id)
                .await
            {
                tracing::error!("Could not send installment paid {e:#}");
            }
        }

        if let Err(e) = db::contract_emails::mark_loan_repaid_as_sent(&self.db, contract_id).await {
            tracing::error!("Failed to mark loan-repaid email as sent: {e:#}");
        }
    }

    pub async fn send_installment_confirmed(
        &self,
        borrower: Borrower,
        url: Url,
        installment_id: Uuid,
        contract_id: &str,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_installment(
            contract_id,
            borrower.id.as_str(),
            installment_id,
            model::InstallmentStatus::Confirmed,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::InstallmentConfirmed,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_installment_confirmed(&borrower, url, contract_id)
                .await
            {
                tracing::error!("Could not send installment confirmed {e:#}");
            }
        }
    }

    pub async fn send_loan_liquidated_after_default(
        &self,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_contract_status(
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::ClosedByDefaulting,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::LiquidatedAfterDefault,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_loan_liquidated_after_default(borrower, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send loan liquidated after default {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_defaulted_loan_liquidated_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark defaulted-loan-liquidated email as sent: {e:#}");
        }
    }

    pub async fn send_loan_defaulted_lender(&self, lender: Lender, url: Url, contract_id: &str) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        self.notify_lender_frontend_contract_status(
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::Defaulted,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                url.clone(),
                crate::telegram_bot::LenderNotificationKind::Defaulted,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_loan_defaulted_lender(&lender, url, contract_id)
                .await
            {
                tracing::error!("Could not send loan defaulted lender notification {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_defaulted_loan_lender_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark defaulted-loan-lender email as sent: {e:#}");
        }
    }

    pub async fn send_loan_defaulted_borrower(
        &self,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_contract_status(
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::Defaulted,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::LoanDefaulted,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_loan_defaulted_borrower(borrower, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send loan defaulted borrower {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_defaulted_loan_borrower_as_sent(&self.db, contract_id).await
        {
            tracing::error!("Failed to mark defaulted-loan-borrower email as sent: {e:#}");
        }
    }

    pub async fn send_expired_loan_request_borrower(
        &self,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_contract_status(
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::RequestExpired,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::LoanRequestExpired,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_expired_loan_request_borrower(borrower, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send loan request expired borrower {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_loan_request_expired_borrower_as_sent(&self.db, contract_id)
                .await
        {
            tracing::error!("Failed to mark loan-request-expired-borrower email as sent: {e:#}");
        }
    }

    pub async fn send_expired_loan_application_borrower(
        &self,
        borrower: Borrower,
        days: i64,
        contract_url: Url,
        application_id: &str,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::LoanApplicationExpired { days },
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_expired_loan_application_borrower(
                    borrower,
                    days,
                    contract_url,
                    application_id,
                )
                .await
            {
                tracing::error!("Could not send loan application expired borrower {e:#}");
            }
        }
    }

    pub async fn send_expired_loan_request_lender(
        &self,
        lender: Lender,
        url: Url,
        contract_id: &str,
    ) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        self.notify_lender_frontend_contract_status(
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::RequestExpired,
        )
        .await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                url.clone(),
                crate::telegram_bot::LenderNotificationKind::RequestExpired,
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Err(e) = self
                .email
                .send_expired_loan_request_lender(&lender, url, contract_id)
                .await
            {
                tracing::error!("Could not send loan request expired lender {e:#}");
            }
        }

        if let Err(e) =
            db::contract_emails::mark_loan_request_expired_lender_as_sent(&self.db, contract_id)
                .await
        {
            tracing::error!("Failed to mark loan-request-expired-lender email as sent: {e:#}");
        }
    }

    pub async fn send_chat_notification_lender(
        &self,
        lender: Lender,
        contract_url: Url,
        contract_id: &str,
    ) {
        let settings = load_lender_notification_settings(&self.db, lender.id.as_str()).await;

        self.notify_lender_frontend_chat_message(contract_id, lender.id.as_str())
            .await;

        if settings.new_chat_message_telegram {
            self.send_tg_notification_lender(
                lender.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::LenderNotificationKind::NewChatMessage {
                    name: lender.name.clone(),
                },
            )
            .await;
        }

        if settings.new_chat_message_email {
            if let Err(e) = self
                .email
                .send_new_chat_message_notification_lender(&lender, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send chat notification email lender {e:#}");
            }
        }
    }

    pub async fn send_chat_notification_borrower(
        &self,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        self.notify_borrower_frontend_chat_message(contract_id, borrower.id.as_str())
            .await;

        if settings.new_chat_message_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::NewChatMessage {
                    name: borrower.name.clone(),
                },
            )
            .await;
        }

        if settings.new_chat_message_email {
            if let Err(e) = self
                .email
                .send_new_chat_message_notification_borrower(borrower, contract_url, contract_id)
                .await
            {
                tracing::error!("Could not send chat notification borrower {e:#}");
            }
        }
    }

    pub async fn send_contract_extension_enabled(
        &self,
        borrower: Borrower,
        contract_url: Url,
        contract_id: &str,
    ) {
        let settings = load_borrower_notification_settings(&self.db, borrower.id.as_str()).await;

        if settings.contract_status_changed_telegram {
            self.send_tg_notification_borrower(
                borrower.id.as_str(),
                contract_url.clone(),
                crate::telegram_bot::BorrowerNotificationKind::ContractExtensionEnabled {
                    name: borrower.name.clone(),
                },
            )
            .await;
        }

        if settings.contract_status_changed_email {
            if let Some(email) = borrower.email.as_ref() {
                if let Err(e) = self
                    .email
                    .send_loan_extension_enabled(
                        borrower.name.as_str(),
                        email.as_str(),
                        contract_url,
                        contract_id,
                    )
                    .await
                {
                    tracing::error!("Could not send email notification borrower {e:#}");
                }
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn send_new_loan_offer_available(
        &self,
        offer_url: Url,
        min_loan_amount: Decimal,
        max_loan_amount: Decimal,
        asset: LoanAsset,
        interest_rate: Decimal,
        min_duration: i32,
        max_duration: i32,
    ) {
        match db::notification_settings::get_borrowers_for_loan_offer_notifications(&self.db).await
        {
            Ok(contact_details) => {
                let filtered_users = contact_details
                    .iter()
                    .filter(|details| details.new_loan_offer_telegram.unwrap_or_default())
                    .collect::<Vec<_>>();
                for borrower in filtered_users {
                    self.send_tg_notification_borrower(
                        borrower.id.as_str(),
                        offer_url.clone(),
                        crate::telegram_bot::BorrowerNotificationKind::NewLoanOfferAvailable {
                            name: borrower.name.clone(),
                            min_loan_amount,
                            max_loan_amount,
                            asset,
                            interest_rate,
                            min_duration,
                            max_duration,
                        },
                    )
                    .await
                }

                let filtered_users = contact_details
                    .iter()
                    .filter(|details| details.new_loan_offer_email.unwrap_or_default())
                    .filter_map(|details| {
                        details
                            .email
                            .clone()
                            .map(|email| (details.name.clone(), email))
                    })
                    .collect::<Vec<_>>();

                if let Err(e) = self
                    .email
                    .send_new_loan_offer(
                        filtered_users,
                        offer_url,
                        min_loan_amount,
                        max_loan_amount,
                        asset,
                        interest_rate,
                        min_duration,
                        max_duration,
                    )
                    .await
                {
                    tracing::error!("Could not send email notification borrower {e:#}");
                }
            }
            Err(error) => {
                tracing::error!(
                    "Failed loading borrowers for new loan offer notifications {error:#}"
                )
            }
        }
    }

    pub async fn send_new_loan_application_available(
        &self,
        offer_url: Url,
        loan_amount: Decimal,
        asset: LoanAsset,
        interest_rate: Decimal,
        duration: i32,
    ) {
        match db::notification_settings::get_lenders_for_loan_loan_application(&self.db).await {
            Ok(contact_details) => {
                let filtered_users = contact_details
                    .iter()
                    .filter(|details| details.new_loan_applications_telegram.unwrap_or_default())
                    .collect::<Vec<_>>();
                for lender in filtered_users {
                    self.send_tg_notification_lender(
                        lender.id.as_str(),
                        offer_url.clone(),
                        crate::telegram_bot::LenderNotificationKind::NewApplicationAvailable {
                            name: lender.name.clone(),
                            loan_amount,
                            asset,
                            interest_rate,
                            duration,
                        },
                    )
                    .await
                }

                let filtered_users = contact_details
                    .iter()
                    .filter(|details| details.new_loan_applications_email.unwrap_or_default())
                    .filter_map(|details| {
                        details
                            .email
                            .clone()
                            .map(|email| (details.name.clone(), email))
                    })
                    .collect::<Vec<_>>();

                if let Err(e) = self
                    .email
                    .send_new_loan_applications(
                        filtered_users,
                        offer_url,
                        loan_amount,
                        asset,
                        interest_rate,
                        duration,
                    )
                    .await
                {
                    tracing::error!("Could not send email notification lenders {e:#}");
                }
            }
            Err(error) => {
                tracing::error!(
                    "Failed loading lenders for new loan application notifications {error:#}"
                )
            }
        }
    }

    async fn send_tg_notification_lender(
        &self,
        lender_id: &str,
        url: Url,
        kind: crate::telegram_bot::LenderNotificationKind,
    ) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    user_id: lender_id.to_string(),
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
        user_id: &str,
        contract_url: Url,
        kind: crate::telegram_bot::BorrowerNotificationKind,
    ) {
        if let Some(tgb) = &self.telegram_bot {
            if let Err(e) = tgb
                .send(crate::telegram_bot::Notification {
                    user_id: user_id.to_string(),
                    url: contract_url,
                    kind: crate::telegram_bot::NotificationTarget::Borrower(kind),
                })
                .await
            {
                tracing::error!("Failed sending to telegram actor {e:#}");
            }
        }
    }

    async fn notify_lender_frontend_contract_status(
        &self,
        contract_id: &str,
        lender_id: &str,
        status: model::db::ContractStatus,
    ) {
        match db::notifications::lender::insert_contract_update_notification(
            &self.db,
            contract_id,
            status,
        )
        .await
        {
            Ok(notification) => {
                self.notify_lender_frontend(lender_id, notification.into())
                    .await;
            }
            Err(err) => {
                tracing::error!("Failed inserting lender contract update notification {err:#}");
            }
        }
    }

    async fn notify_lender_frontend_installment(
        &self,
        contract_id: &str,
        lender_id: &str,
        installment_id: Uuid,
        status: model::InstallmentStatus,
    ) {
        match db::notifications::lender::insert_installment_update_notification(
            &self.db,
            installment_id,
            contract_id,
            status,
        )
        .await
        {
            Ok(notification) => {
                self.notify_lender_frontend(lender_id, notification.into())
                    .await;
            }
            Err(err) => {
                tracing::error!("Failed inserting lender installment update notification {err:#}");
            }
        }
    }

    async fn notify_lender_frontend_chat_message(&self, contract_id: &str, lender_id: &str) {
        match db::notifications::lender::insert_chat_message_notification(&self.db, contract_id)
            .await
        {
            Ok(notification) => {
                self.notify_lender_frontend(lender_id, notification.into())
                    .await;
            }
            Err(err) => {
                tracing::error!("Failed inserting lender chat message update notification {err:#}");
            }
        }
    }

    async fn notify_lender_frontend(&self, lender_id: &str, notification: NotificationMessage) {
        if let Err(e) = self.websocket.send_to(lender_id, notification).await {
            tracing::error!("Could not send notification via websocket {e:#}");
        }
    }

    async fn notify_borrower_frontend_contract_status(
        &self,
        contract_id: &str,
        borrower_id: &str,
        status: model::db::ContractStatus,
    ) {
        match db::notifications::borrower::insert_contract_update_notification(
            &self.db,
            contract_id,
            status,
        )
        .await
        {
            Ok(notification) => {
                self.notify_borrower_frontend(borrower_id, notification.into())
                    .await;
            }
            Err(err) => {
                tracing::error!("Failed inserting borrower contract update notification {err:#}");
            }
        }
    }

    async fn notify_borrower_frontend_installment(
        &self,
        contract_id: &str,
        borrower_id: &str,
        installment_id: Uuid,
        status: model::InstallmentStatus,
    ) {
        match db::notifications::borrower::insert_installment_update_notification(
            &self.db,
            installment_id,
            contract_id,
            status,
        )
        .await
        {
            Ok(notification) => {
                self.notify_borrower_frontend(borrower_id, notification.into())
                    .await;
            }
            Err(err) => {
                tracing::error!(
                    "Failed inserting borrower installment update notification {err:#}"
                );
            }
        }
    }

    async fn notify_borrower_frontend_chat_message(&self, contract_id: &str, borrower_id: &str) {
        match db::notifications::borrower::insert_chat_message_notification(&self.db, contract_id)
            .await
        {
            Ok(notification) => {
                self.notify_borrower_frontend(borrower_id, notification.into())
                    .await;
            }
            Err(err) => {
                tracing::error!(
                    "Failed inserting borrower chat message update notification {err:#}"
                );
            }
        }
    }

    async fn notify_borrower_frontend(&self, borrower_id: &str, notification: NotificationMessage) {
        if let Err(e) = self.websocket.send_to(borrower_id, notification).await {
            tracing::error!("Could not send notification via websocket {e:#}");
        }
    }
}

async fn load_borrower_notification_settings(
    db: &PgPool,
    id: &str,
) -> model::notifications::BorrowerNotificationSettings {
    match db::notification_settings::get_borrower_notification_settings(db, id).await {
        Ok(settings) => settings,
        Err(err) => {
            tracing::error!("Failed loading borrower notification settings {err:#}");
            model::notifications::BorrowerNotificationSettings::new(id.to_string())
        }
    }
}

async fn load_lender_notification_settings(
    db: &PgPool,
    id: &str,
) -> model::notifications::LenderNotificationSettings {
    match db::notification_settings::get_lender_notification_settings(db, id).await {
        Ok(settings) => settings,
        Err(err) => {
            tracing::error!("Failed loading borrower notification settings {err:#}");
            model::notifications::LenderNotificationSettings::new(id.to_string())
        }
    }
}
