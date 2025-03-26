use crate::config::Config;
use crate::model::Borrower;
use crate::model::Contract;
use crate::model::Lender;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use handlebars::Handlebars;
use include_dir::include_dir;
use include_dir::Dir;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::AsyncSmtpTransport;
use lettre::AsyncTransport;
use lettre::Message;
use lettre::Tokio1Executor;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use time::format_description;
use time::Duration;
use url::Url;

static TEMPLATES_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../templates");
const DISPUTE_ADMIN_EMAIL: &str = "dispute-center@lendasat.com";

pub(crate) struct Email {
    from: String,
    smtp_user: String,
    smtp_pass: String,
    smtp_host: String,
    smtp_port: u16,
    smtp_disabled: bool,
}

impl Email {
    pub fn new(config: Config) -> Self {
        let from = format!("Lendasat <{}>", config.smtp_from.to_owned());

        Self {
            from,
            smtp_user: config.smtp_user,
            smtp_pass: config.smtp_pass,
            smtp_host: config.smtp_host,
            smtp_port: config.smtp_port,
            smtp_disabled: config.smtp_disabled,
        }
    }

    fn new_transport(
        &self,
    ) -> Result<AsyncSmtpTransport<Tokio1Executor>, lettre::transport::smtp::Error> {
        let creds = Credentials::new(self.smtp_user.to_owned(), self.smtp_pass.to_owned());

        let transport =
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&self.smtp_host.to_owned())?
                .port(self.smtp_port)
                .credentials(creds)
                .build();

        Ok(transport)
    }

    fn get_template_content(file_name: &str) -> Result<String> {
        match TEMPLATES_DIR.get_file(file_name) {
            None => {
                bail!("Could not find file {file_name}");
            }

            Some(file) => {
                let x = file
                    .contents_utf8()
                    .context("Could not parse file content")?;

                Ok(x.to_string())
            }
        }
    }

    async fn send_email(
        &self,
        subject: &str,
        user_name: &str,
        user_email: &str,
        html_template: String,
    ) -> Result<()> {
        let email = Message::builder()
            .to(format!("{} <{}>", user_name, user_email).parse()?)
            .reply_to(self.from.as_str().parse()?)
            .from(self.from.as_str().parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html_template.clone())?;

        let transport = self.new_transport()?;

        if self.smtp_disabled {
            tracing::info!("Sending smtp is disabled.");
            return Ok(());
        }

        let subject = subject.to_string();
        let user_email = user_email.to_string();
        let html_template = html_template.clone();

        tokio::spawn(async move {
            if let Err(err) = transport.send(email).await {
                tracing::error!(
                    subject,
                    user_email,
                    template_name = html_template,
                    "Failed at sending email {err:#}"
                );
            } else {
                tracing::info!(
                    subject,
                    user_email,
                    template_name = html_template,
                    "Email sent"
                );
            }
        });
        Ok(())
    }

    fn prepare_template(template_name: &str) -> Result<Handlebars> {
        let mut handlebars = Handlebars::new();
        let content = Self::get_template_content(&format!("{}.hbs", template_name))?;
        handlebars.register_template_string(template_name, content)?;
        let content = Self::get_template_content("partials/styles.hbs")?;
        handlebars.register_template_string("styles", content)?;
        let content = Self::get_template_content("layouts/base.hbs")?;
        handlebars.register_template_string("base", content)?;
        Ok(handlebars)
    }

    pub async fn send_verification_code(
        &self,
        name: &str,
        email: &str,
        url: Url,
        code: &str,
    ) -> Result<()> {
        let template_name = "verification_code";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": name,
            "subject": &template_name,
            "url": url,
            "code": code,
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email("Lendasat email verification", name, email, content_template)
            .await
    }

    pub async fn send_password_reset_token(
        &self,
        name: &str,
        email: &str,
        token_expiry_minutes: i64,
        url: Url,
    ) -> Result<()> {
        let template_name = "reset_password";
        let handlebars = Self::prepare_template(template_name)?;

        let subject = "Lendasat reset password request";

        let data = serde_json::json!({
            "first_name": name,
            "subject": subject,
            "url": url,
            "expiry_minutes": token_expiry_minutes,
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(subject, name, email, content_template)
            .await
    }

    pub async fn send_start_dispute(
        &self,
        name: &str,
        email: &str,
        dispute_id: &str,
    ) -> Result<()> {
        let template_name = "start_dispute";
        let handlebars = Self::prepare_template(template_name)?;

        let subject = format!("You have started a dispute - {}", dispute_id);

        let data = serde_json::json!({
            "first_name": name,
            "subject": subject,
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(subject.as_str(), name, email, content_template)
            .await
    }

    pub async fn send_notify_admin_about_dispute(
        &self,
        user: Borrower,
        dispute_id: &str,
        lender_id: &str,
        borrower_id: &str,
        contract_id: &str,
    ) -> Result<()> {
        let template_name = "notify_admin_dispute";

        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": user.name.as_str(),
            "subject": &template_name,
            "lender_id": lender_id,
            "borrower_id": borrower_id,
            "contract_id": contract_id,
            "dispute_id": dispute_id,
        });

        let html_template = handlebars.render(template_name, &data)?;

        self.send_email(
            format!("Dispute started {} ", dispute_id).as_str(),
            "admin",
            DISPUTE_ADMIN_EMAIL,
            html_template,
        )
        .await
    }

    pub async fn send_user_about_margin_call(
        &self,
        user: Borrower,
        contract: Contract,
        price: Decimal,
        current_ltv: Decimal,
        contract_url: Url,
    ) -> Result<()> {
        let template_name = "margin_call";

        let handlebars = Self::prepare_template(template_name)?;

        let expiry = contract.created_at + Duration::days(contract.duration_days as i64);
        let collateral_value_usd = (Decimal::from_u64(contract.collateral_sats)
            .expect("to fit into u64")
            / dec!(100_000_000))
            * price;
        let collateral_value_usd = collateral_value_usd.round_dp(2).to_string();

        let format = format_description::parse(
            "[year]-[month]-[day] [hour]:[minute]:[second] [offset_hour \
         sign:mandatory]:[offset_minute]:[offset_second]",
        )
        .expect("to be valid");

        let expiry = expiry.format(&format).expect("to be valid");

        let current_ltv = (current_ltv * dec!(100)).round_dp(2).to_string();

        let liquidation_price = contract.liquidation_price().round_dp(2).to_string();

        let data = serde_json::json!({
            "first_name": user.name.as_str(),
            "contract_id": contract.id,
            "loan_amount": contract.loan_amount,
            "expiry": expiry,
            "collateral_sats": contract.collateral_sats,
            "collateral_value_usd": collateral_value_usd,
            "current_ltv": current_ltv,
            "liquidation_price": liquidation_price,
            "contract_url": contract_url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = user.email {
            self.send_email(
                "You have received a margin call",
                user.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_liquidation_notice_borrower(
        &self,
        borrower: Borrower,
        contract: Contract,
        price: Decimal,
        contract_url: Url,
    ) -> Result<()> {
        let template_name = "liquidated_borrower";

        let handlebars = Self::prepare_template(template_name)?;

        let liquidation_price = contract.liquidation_price().round_dp(2).to_string();

        let price = price.round_dp(2).to_string();

        let data = serde_json::json!({
            "first_name": borrower.name.as_str(),
            "contract_id": contract.id,
            "latest_price": price,
            "liquidation_price": liquidation_price,
            "contract_url": contract_url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = borrower.email {
            self.send_email(
                "Your contract has been liquidated",
                borrower.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_liquidation_notice_lender(
        &self,
        lender: Lender,
        contract: Contract,
        contract_url: Url,
    ) -> Result<()> {
        let template_name = "liquidated_lender";

        let handlebars = Self::prepare_template(template_name)?;

        let contract_url = contract_url.as_str();

        let data = serde_json::json!({
            "first_name": lender.name.as_str(),
            "contract_id": contract.id,
            "contract_url": contract_url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "Time to liquidate the borrower's collateral",
            lender.name.as_str(),
            lender.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_new_loan_request(&self, lender: Lender, url: Url) -> Result<()> {
        let template_name = "loan_requested";
        let handlebars = Self::prepare_template(template_name)?;
        let url = url.as_str();

        let data = serde_json::json!({
            "first_name": &lender.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "You have received a new loan request",
            lender.name.as_str(),
            lender.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_loan_request_approved(&self, borrower: Borrower, url: Url) -> Result<()> {
        let template_name = "loan_request_approved";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &borrower.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = borrower.email {
            self.send_email(
                "Your loan request has been approved",
                borrower.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_notification_about_auto_accepted_loan(
        &self,
        lender: Lender,
        url: Url,
    ) -> Result<()> {
        let template_name = "loan_request_auto_approved";
        let handlebars = Self::prepare_template(template_name)?;
        let url = url.as_str();

        let data = serde_json::json!({
            "first_name": &lender.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "Your loan request has been approved",
            lender.name.as_str(),
            lender.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_loan_request_rejected(&self, borrower: Borrower, url: Url) -> Result<()> {
        let template_name = "loan_request_rejected";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &borrower.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = borrower.email {
            self.send_email(
                "Your loan request has been declined",
                borrower.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_loan_collateralized(&self, user: Lender, url: Url) -> Result<()> {
        let template_name = "loan_collateralized";
        let handlebars = Self::prepare_template(template_name)?;

        let url = url.as_str();

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "The borrower has deposited the collateral",
            user.name.as_str(),
            user.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_loan_paid_out(&self, user: Borrower, url: Url) -> Result<()> {
        let template_name = "loan_paid_out";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = user.email {
            self.send_email(
                "Your loan has been paid out",
                user.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_close_to_expiry_contract(
        &self,
        user: Borrower,
        expiry_date: &str,
        url: Url,
    ) -> Result<()> {
        let template_name = "loan_close_to_expiry";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "expiry_date": &expiry_date,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = user.email {
            self.send_email(
                "Time to repay your loan",
                user.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_moon_card_ready(&self, user: Borrower, url: Url) -> Result<()> {
        let template_name = "pay_with_moon_ready";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = user.email {
            self.send_email(
                "Your debit card has been funded",
                user.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }
        Ok(())
    }

    pub async fn send_loan_repaid(&self, user: Lender, url: Url) -> Result<()> {
        let template_name = "loan_repaid";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "The borrower has repaid the loan",
            user.name.as_str(),
            user.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_loan_liquidated_after_default(&self, user: Borrower, url: Url) -> Result<()> {
        let template_name = "loan_liquidated_default";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = user.email {
            self.send_email(
                "Your defaulted loan was liquidated",
                user.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_loan_defaulted_lender(&self, user: Lender, url: Url) -> Result<()> {
        let template_name = "loan_defaulted_lender";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "Your loan expired without repayment",
            user.name.as_str(),
            user.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_loan_defaulted_borrower(&self, user: Borrower, url: Url) -> Result<()> {
        let template_name = "loan_defaulted_borrower";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &user.name,
            "subject": &template_name,
            "url": url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = user.email {
            self.send_email(
                "Your loan expired without repayment",
                user.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_expired_loan_request_borrower(
        &self,
        borrower: Borrower,
        offers_url: Url,
    ) -> Result<()> {
        let template_name = "loan_request_expired_borrower";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &borrower.name,
            "subject": &template_name,
            "url": offers_url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = borrower.email {
            self.send_email(
                "Your loan request expired without response",
                borrower.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn send_expired_loan_request_lender(
        &self,
        lender: Lender,
        create_new_offer_url: Url,
    ) -> Result<()> {
        let template_name = "loan_request_expired_lender";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &lender.name,
            "subject": &template_name,
            "url": create_new_offer_url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "A contract request expired without response",
            lender.name.as_str(),
            lender.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_new_chat_message_notification_lender(
        &self,
        lender: Lender,
        contract_url: Url,
    ) -> Result<()> {
        let template_name = "new_chat_notification";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &lender.name,
            "subject": &template_name,
            "contract_url": contract_url
        });

        let content_template = handlebars.render(template_name, &data)?;

        self.send_email(
            "New chat message",
            lender.name.as_str(),
            lender.email.as_str(),
            content_template,
        )
        .await
    }

    pub async fn send_new_chat_message_notification_borrower(
        &self,
        borrower: Borrower,
        contract_url: Url,
    ) -> Result<()> {
        let template_name = "new_chat_notification";
        let handlebars = Self::prepare_template(template_name)?;

        let data = serde_json::json!({
            "first_name": &borrower.name,
            "subject": &template_name,
            "contract_url": contract_url
        });

        let content_template = handlebars.render(template_name, &data)?;

        if let Some(email) = borrower.email {
            self.send_email(
                "New chat message",
                borrower.name.as_str(),
                email.as_str(),
                content_template,
            )
            .await?;
        }

        Ok(())
    }
}
