use crate::config::Config;
use crate::db;
use crate::model;
use crate::model::Borrower;
use crate::model::Contract;
use crate::model::Lender;
use crate::model::NotificationMessage;
use crate::notifications::websocket::NotificationCenter;
use crate::telegram_bot::TelegramBot;
use rust_decimal::Decimal;
use sqlx::PgPool;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use url::Url;
use uuid::Uuid;
use xtra::Address;

mod email;
pub mod websocket;

pub struct Notifications {
    email: email::Email,
    telegram_bot: Option<Address<TelegramBot>>,
    pub(crate) websocket: NotificationCenter,
}

impl Notifications {
    pub fn new(
        config: Config,
        maybe_telegram_bot: Option<Address<TelegramBot>>,
        center: NotificationCenter,
    ) -> Self {
        Self {
            email: email::Email::new(config),
            telegram_bot: maybe_telegram_bot,
            websocket: center,
        }
    }

    pub async fn send_login_information_borrower(
        &self,
        borrower: Borrower,
        profile_url: Url,
        ip_address: &str,
        login_time: OffsetDateTime,
        location: Option<String>,
        device: &str,
    ) {
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
        self.send_tg_notification_borrower(
            &borrower,
            profile_url,
            crate::telegram_bot::BorrowerNotificationKind::LoginNotification {
                name: borrower.name.clone(),
                ip_address: ip_address.to_string(),
                login_time,
            },
        )
        .await;
    }

    pub async fn send_login_information_lender(
        &self,
        lender: &Lender,
        profile_url: Url,
        ip_address: &str,
        login_time: OffsetDateTime,
        location: Option<String>,
        device: &str,
    ) {
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

        self.send_tg_notification_lender(
            lender,
            profile_url,
            crate::telegram_bot::LenderNotificationKind::LoginNotification {
                name: lender.name.clone(),
                ip_address: ip_address.to_string(),
                login_time,
            },
        )
        .await;
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

    pub async fn send_start_dispute(&self, name: &str, email: &str, dispute_id: &str) {
        if let Err(e) = self.email.send_start_dispute(name, email, dispute_id).await {
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
            &borrower,
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
        pool: &PgPool,
        borrower: Borrower,
        contract: Contract,
        price: Decimal,
        liquidation_price: Decimal,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            pool,
            contract.id.as_str(),
            borrower.id.as_str(),
            model::db::ContractStatus::Undercollateralized,
        )
        .await;

        self.send_tg_notification_borrower(
            &borrower,
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
        pool: &Pool<Postgres>,
    ) {
        self.notify_lender_frontend_contract_status(
            pool,
            contract.id.as_str(),
            lender.id.as_str(),
            model::db::ContractStatus::Undercollateralized,
        )
        .await;

        self.send_tg_notification_lender(
            &lender,
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

    pub async fn send_new_loan_request(
        &self,
        lender: Lender,
        url: Url,
        contract_id: &str,
        pool: &PgPool,
    ) {
        self.notify_lender_frontend_contract_status(
            pool,
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::Requested,
        )
        .await;

        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::NewLoanRequest,
        )
        .await;

        if let Err(e) = self.email.send_new_loan_request(&lender, url).await {
            tracing::error!("Could not send new loan request {e:#}");
        }
    }

    pub async fn send_loan_request_approved(
        &self,
        pool: &PgPool,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            pool,
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::Approved,
        )
        .await;

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
            tracing::error!("Could not send loan request approved {e:#}");
        }
    }

    pub async fn send_notification_about_auto_accepted_loan(
        &self,
        lender: Lender,
        url: Url,
        contract_id: &str,
        pool: &PgPool,
    ) {
        self.notify_lender_frontend_contract_status(
            pool,
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::Approved,
        )
        .await;

        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::RequestAutoApproved,
        )
        .await;

        if let Err(e) = self
            .email
            .send_notification_about_auto_accepted_loan(&lender, url)
            .await
        {
            tracing::error!("Could not send auto accept notification {e:#}");
        }
    }

    pub async fn send_loan_request_rejected(
        &self,
        pool: &PgPool,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            pool,
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::Rejected,
        )
        .await;

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
            tracing::error!("Could not send request rejected {e:#}");
        }
    }

    pub async fn send_loan_collateralized(
        &self,
        lender: Lender,
        url: Url,
        pool: &PgPool,
        contract_id: &str,
    ) {
        self.notify_lender_frontend_contract_status(
            pool,
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::CollateralConfirmed,
        )
        .await;

        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::Collateralized,
        )
        .await;

        if let Err(e) = self.email.send_loan_collateralized(&lender, url).await {
            tracing::error!("Could not send loan collateralized {e:#}");
        }
    }

    pub async fn send_loan_paid_out(
        &self,
        pool: &PgPool,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            pool,
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::PrincipalGiven,
        )
        .await;

        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LoanPaidOut,
        )
        .await;

        if let Err(e) = self.email.send_loan_paid_out(borrower, contract_url).await {
            tracing::error!("Could not send loan paid out {e:#}");
        }
    }

    pub async fn send_installment_due_soon(
        &self,
        pool: &PgPool,
        contract_id: &str,
        installment_id: Uuid,
        borrower: Borrower,
        expiry_date: &str,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_installment(
            pool,
            contract_id,
            borrower.id.as_str(),
            installment_id,
            model::InstallmentStatus::Pending,
        )
        .await;

        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::InstallmentDueSoon,
        )
        .await;

        if let Err(e) = self
            .email
            .send_installment_due_soon(borrower, expiry_date, contract_url)
            .await
        {
            tracing::error!("Could not send installment due soon: {e:#}");
        }
    }

    pub async fn send_moon_card_ready(&self, borrower: Borrower, contract_url: Url) {
        // TODO: introduce new event

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
            tracing::error!("Could not send moon card ready {e:#}");
        }
    }

    pub async fn send_installment_paid(
        &self,
        lender: Lender,
        url: Url,
        pool: &PgPool,
        installment_id: Uuid,
        contract_id: &str,
    ) {
        self.notify_lender_frontend_installment(
            pool,
            contract_id,
            lender.id.as_str(),
            installment_id,
            model::InstallmentStatus::Paid,
        )
        .await;

        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::InstallmentPaid,
        )
        .await;

        if let Err(e) = self.email.send_installment_paid(&lender, url).await {
            tracing::error!("Could not send installment paid {e:#}");
        }
    }

    pub async fn send_installment_confirmed(
        &self,
        borrower: Borrower,
        url: Url,
        pool: &PgPool,
        installment_id: Uuid,
        contract_id: &str,
    ) {
        self.notify_borrower_frontend_installment(
            pool,
            contract_id,
            borrower.id.as_str(),
            installment_id,
            model::InstallmentStatus::Confirmed,
        )
        .await;

        self.send_tg_notification_borrower(
            &borrower,
            url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::InstallmentConfirmed,
        )
        .await;

        if let Err(e) = self.email.send_installment_confirmed(&borrower, url).await {
            tracing::error!("Could not send installment confirmed {e:#}");
        }
    }

    pub async fn send_loan_liquidated_after_default(
        &self,
        pool: &PgPool,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            pool,
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::ClosedByDefaulting,
        )
        .await;

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
            tracing::error!("Could not send loan liquidated after default {e:#}");
        }
    }

    pub async fn send_loan_defaulted_lender(
        &self,
        lender: Lender,
        url: Url,
        pool: &PgPool,
        contract_id: &str,
    ) {
        self.notify_lender_frontend_contract_status(
            pool,
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::Defaulted,
        )
        .await;

        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::Defaulted,
        )
        .await;

        if let Err(e) = self.email.send_loan_defaulted_lender(&lender, url).await {
            tracing::error!("Could not send loan defaulted lender notification {e:#}");
        }
    }

    pub async fn send_loan_defaulted_borrower(
        &self,
        pool: &PgPool,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            pool,
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::Defaulted,
        )
        .await;

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
            tracing::error!("Could not send loan defaulted borrower {e:#}");
        }
    }

    pub async fn send_expired_loan_request_borrower(
        &self,
        pool: &PgPool,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_contract_status(
            pool,
            contract_id,
            borrower.id.as_str(),
            model::db::ContractStatus::RequestExpired,
        )
        .await;

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
            tracing::error!("Could not send loan request expired borrower {e:#}");
        }
    }

    pub async fn send_expired_loan_application_borrower(
        &self,
        borrower: Borrower,
        days: i64,
        contract_url: Url,
    ) {
        // TODO: introduce special event

        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::LoanApplicationExpired { days },
        )
        .await;

        if let Err(e) = self
            .email
            .send_expired_loan_application_borrower(borrower, days, contract_url)
            .await
        {
            tracing::error!("Could not send loan application expired borrower {e:#}");
        }
    }

    pub async fn send_expired_loan_request_lender(
        &self,
        lender: Lender,
        url: Url,
        pool: &PgPool,
        contract_id: &str,
    ) {
        self.notify_lender_frontend_contract_status(
            pool,
            contract_id,
            lender.id.as_str(),
            model::db::ContractStatus::RequestExpired,
        )
        .await;
        self.send_tg_notification_lender(
            &lender,
            url.clone(),
            crate::telegram_bot::LenderNotificationKind::RequestExpired,
        )
        .await;

        if let Err(e) = self
            .email
            .send_expired_loan_request_lender(&lender, url)
            .await
        {
            tracing::error!("Could not send loan request expired lender {e:#}");
        }
    }

    pub async fn send_chat_notification_lender(
        &self,
        lender: Lender,
        contract_url: Url,
        pool: &PgPool,
        contract_id: &str,
    ) {
        self.notify_lender_frontend_chat_message(pool, contract_id, lender.id.as_str())
            .await;
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
            .send_new_chat_message_notification_lender(&lender, contract_url)
            .await
        {
            tracing::error!("Could not send chat notification email lender {e:#}");
        }
    }

    pub async fn send_chat_notification_borrower(
        &self,
        pool: &PgPool,
        contract_id: &str,
        borrower: Borrower,
        contract_url: Url,
    ) {
        self.notify_borrower_frontend_chat_message(pool, contract_id, borrower.id.as_str())
            .await;

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
            tracing::error!("Could not send chat notification borrower {e:#}");
        }
    }

    pub async fn send_contract_extension_enabled(&self, borrower: Borrower, contract_url: Url) {
        // TODO: introduce new event type for this

        self.send_tg_notification_borrower(
            &borrower,
            contract_url.clone(),
            crate::telegram_bot::BorrowerNotificationKind::ContractExtensionEnabled {
                name: borrower.name.clone(),
            },
        )
        .await;

        if let Some(email) = borrower.email.as_ref() {
            if let Err(e) = self
                .email
                .send_loan_extension_enabled(borrower.name.as_str(), email.as_str(), contract_url)
                .await
            {
                tracing::error!("Could not send email notification borrower {e:#}");
            }
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

    async fn notify_lender_frontend_contract_status(
        &self,
        pool: &Pool<Postgres>,
        contract_id: &str,
        lender_id: &str,
        status: model::db::ContractStatus,
    ) {
        match db::notifications::lender::insert_contract_update_notification(
            pool,
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
        pool: &Pool<Postgres>,
        contract_id: &str,
        lender_id: &str,
        installment_id: Uuid,
        status: model::InstallmentStatus,
    ) {
        match db::notifications::lender::insert_installment_update_notification(
            pool,
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

    async fn notify_lender_frontend_chat_message(
        &self,
        pool: &Pool<Postgres>,
        contract_id: &str,
        lender_id: &str,
    ) {
        match db::notifications::lender::insert_chat_message_notification(pool, contract_id).await {
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
        pool: &Pool<Postgres>,
        contract_id: &str,
        borrower_id: &str,
        status: model::db::ContractStatus,
    ) {
        match db::notifications::borrower::insert_contract_update_notification(
            pool,
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
        pool: &Pool<Postgres>,
        contract_id: &str,
        borrower_id: &str,
        installment_id: Uuid,
        status: model::InstallmentStatus,
    ) {
        match db::notifications::borrower::insert_installment_update_notification(
            pool,
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

    async fn notify_borrower_frontend_chat_message(
        &self,
        pool: &Pool<Postgres>,
        contract_id: &str,
        borrower_id: &str,
    ) {
        match db::notifications::borrower::insert_chat_message_notification(pool, contract_id).await
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
