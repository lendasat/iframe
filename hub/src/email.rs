use crate::config::Config;
use crate::model::User;
use anyhow::bail;
use anyhow::Context;
use handlebars::Handlebars;
use include_dir::include_dir;
use include_dir::Dir;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::AsyncSmtpTransport;
use lettre::AsyncTransport;
use lettre::Message;
use lettre::Tokio1Executor;

static TEMPLATES_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../templates");

pub struct Email {
    user: User,
    url: String,
    from: String,
    config: Config,
}

const DISPUTE_ADMIN_EMAIL: &str = "dispute-center@lendasat.com";

impl Email {
    pub fn new(user: User, url: String, config: Config) -> Self {
        let from = format!("Lendasat <{}>", config.smtp_from.to_owned());

        Email {
            user,
            url,
            from,
            config,
        }
    }

    fn new_transport(
        &self,
    ) -> Result<AsyncSmtpTransport<Tokio1Executor>, lettre::transport::smtp::Error> {
        let creds = Credentials::new(
            self.config.smtp_user.to_owned(),
            self.config.smtp_pass.to_owned(),
        );

        let transport = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(
            &self.config.smtp_host.to_owned(),
        )?
        .port(self.config.smtp_port)
        .credentials(creds)
        .build();

        Ok(transport)
    }

    fn render_template(&self, template_name: &str) -> anyhow::Result<String> {
        let mut handlebars = Handlebars::new();
        let content = Self::get_template_content(&format!("{}.hbs", template_name))?;
        handlebars.register_template_string(template_name, content)?;
        let content = Self::get_template_content("partials/styles.hbs")?;
        handlebars.register_template_string("styles", content)?;
        let content = Self::get_template_content("layouts/base.hbs")?;
        handlebars.register_template_string("base", content)?;

        let data = serde_json::json!({
            "first_name": &self.user.name,
            "subject": &template_name,
            "url": &self.url
        });

        let content_template = handlebars.render(template_name, &data)?;

        Ok(content_template)
    }

    fn get_template_content(file_name: &str) -> anyhow::Result<String> {
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
        template_name: &str,
        subject: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let html_template = self.render_template(template_name)?;
        let email = Message::builder()
            .to(format!("{} <{}>", self.user.name.as_str(), self.user.email.as_str()).parse()?)
            .reply_to(self.from.as_str().parse()?)
            .from(self.from.as_str().parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html_template)?;

        let transport = self.new_transport()?;

        if self.config.smtp_disabled {
            let verification_code = self.user.clone().verification_code.unwrap_or_default();
            tracing::info!(
                "Sending smtp is disabled. Verification code is: '{}'.",
                verification_code
            );
            return Ok(());
        }
        transport.send(email).await?;
        Ok(())
    }

    pub async fn send_verification_code(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.send_email("verification_code", "Your account verification code")
            .await
    }

    pub async fn send_password_reset_token(
        &self,
        password_reset_token_expires_in: i64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.send_email(
            "reset_password",
            format!(
                "Your password reset token (valid for only {} minutes)",
                password_reset_token_expires_in
            )
            .as_str(),
        )
        .await
    }

    pub async fn send_start_dispute(
        &self,
        dispute_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.send_email(
            "start_dispute",
            format!("Dispute started {} ", dispute_id).as_str(),
        )
        .await
    }

    pub async fn send_notify_admin_about_dispute(
        &self,
        dispute_id: &str,
        lender_id: &str,
        borrower_id: &str,
        contract_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let template_name = "notify_admin_dispute";

        let mut handlebars = Handlebars::new();
        let content = Self::get_template_content(&format!("{}.hbs", template_name))?;
        handlebars.register_template_string(template_name, content)?;
        let content = Self::get_template_content("partials/styles.hbs")?;
        handlebars.register_template_string("styles", content)?;
        let content = Self::get_template_content("layouts/base.hbs")?;
        handlebars.register_template_string("base", content)?;

        let data = serde_json::json!({
            "first_name": &self.user.name,
            "subject": &template_name,
            "lender_id": lender_id,
            "borrower_id": borrower_id,
            "contract_id": contract_id,
            "dispute_id": dispute_id,
        });

        let html_template = handlebars.render(template_name, &data)?;

        let email = Message::builder()
            .to(format!("{} <{}>", self.user.name.as_str(), DISPUTE_ADMIN_EMAIL).parse()?)
            .reply_to(self.from.as_str().parse()?)
            .from(self.from.as_str().parse()?)
            .subject(format!("Dispute started {} ", dispute_id).as_str())
            .header(ContentType::TEXT_HTML)
            .body(html_template)?;

        let transport = self.new_transport()?;

        if self.config.smtp_disabled {
            tracing::info!("Sending smtp is disabled.",);
            return Ok(());
        }
        transport.send(email).await?;
        Ok(())
    }
}
