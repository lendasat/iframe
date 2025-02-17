use crate::db;
use anyhow::anyhow;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use telegram_bot::MessageToUser;
use telegram_bot::TelegramResponse;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Receiver;
use tokio::sync::mpsc::Sender;
use xtra::Context;
use xtra::Mailbox;

pub struct TelegramBot {
    inner: Arc<telegram_bot::TelegramBot>,
    msg_to_user_tx: Option<Sender<MessageToUser>>,
    register_rx: Option<Receiver<TelegramResponse>>,
    db: Pool<Postgres>,
}

impl xtra::Actor for TelegramBot {
    type Stop = anyhow::Error;

    async fn started(&mut self, mailbox: &Mailbox<Self>) -> Result<()> {
        let (msg_to_user_tx, msg_to_user_rx) = mpsc::channel(100);

        self.msg_to_user_tx = Some(msg_to_user_tx.clone());

        let bot = self.inner.clone();
        tokio::spawn(async move { bot.start(msg_to_user_rx).await });

        let mut register_rx = self.register_rx.take().expect("exists");

        let address = mailbox.address();
        tokio::spawn(async move {
            while let Some(msg) = register_rx.recv().await {
                match msg {
                    TelegramResponse::Register(register) => {
                        if let Err(err) = address
                            .send(Register {
                                id: register.id,
                                token: register.token,
                            })
                            .await
                        {
                            tracing::error!(
                                "Failed sending internal message to register new user {err:#}"
                            );
                        }
                    }
                    TelegramResponse::Unregister(unregister) => {
                        if let Err(err) = address.send(Unregister { id: unregister.id }).await {
                            tracing::error!(
                                "Failed sending internal message to unregister user {err:#}"
                            );
                        }
                    }
                }
            }
        });

        Ok(())
    }

    async fn stopped(self) -> Self::Stop {
        anyhow!("Telegram bot stopped")
    }
}

impl TelegramBot {
    pub fn new(token: &str, db: Pool<Postgres>) -> Self {
        let (register_tx, register_rx) = mpsc::channel::<TelegramResponse>(100);

        let inner = telegram_bot::TelegramBot::new(token, register_tx);
        Self {
            inner: Arc::new(inner),
            db,
            register_rx: Some(register_rx),
            msg_to_user_tx: None,
        }
    }
}

pub struct Register {
    pub id: String,
    pub token: String,
}

impl xtra::Handler<Register> for TelegramBot {
    type Return = Result<()>;

    async fn handle(&mut self, message: Register, _ctx: &mut Context<Self>) -> Self::Return {
        let response = match db::telegram_bot::register_new_chat_id(
            &self.db,
            message.token.as_str(),
            message.id.as_str(),
        )
        .await
        {
            Ok(token) => {
                tracing::debug!(
                    lender_id = token.lender_id,
                    chat_id = message.id,
                    "Registered new chat for user"
                );

                build_message(
                    message.id.clone(),
                    format!(
                        "Welcome, {}. Registration was successful",
                        token.lender_name
                    )
                    .as_str(),
                )
            }
            Err(error) => {
                tracing::error!(chat_id = message.id, "Failed registering {error:#}");

                build_message(
                    message.id.clone(),
                    "Could not register, please double check token or reach out to us",
                )
            }
        };

        match &self.msg_to_user_tx {
            None => {}
            Some(sender) => {
                if let Err(e) = sender.send(response).await {
                    tracing::error!("Failed to send welcome message: {e:#}");
                }
            }
        }
        Ok(())
    }
}

struct Unregister {
    id: String,
}

impl xtra::Handler<Unregister> for TelegramBot {
    type Return = Result<()>;

    async fn handle(&mut self, message: Unregister, _ctx: &mut Context<Self>) -> Self::Return {
        match db::telegram_bot::delete_telegram_bot_chat_id_for_lender(
            &self.db,
            message.id.as_str(),
        )
        .await
        {
            Ok(_) => {
                let response =
                    build_message(message.id.clone(), "You won't receive any more updates");

                if let Some(sender) = &self.msg_to_user_tx {
                    sender.send(response).await?
                }
            }
            Err(error) => {
                tracing::error!("Failed deregistering telegram bot {error:#}")
            }
        }
        Ok(())
    }
}

pub struct Notification {
    pub lender_id: String,
    pub url: String,
    pub kind: NotificationKind,
}

pub enum NotificationKind {
    NewLoanRequest,
    Collateralized,
    Repaid,
    Defaulted,
    LiquidationNotice,
    RequestAutoApproved,
    RequestExpired,
}

impl xtra::Handler<Notification> for TelegramBot {
    type Return = ();

    async fn handle(&mut self, message: Notification, _ctx: &mut Context<Self>) -> Self::Return {
        let url = message.url;

        let text = match message.kind {
            NotificationKind::NewLoanRequest => {
                format!(
                    "You have received a new loan request! \n\nApprove or reject the request [here]({})",
                    url,
                )
            }
            NotificationKind::RequestAutoApproved => {
                format!(
                    "You have received a new loan request! \nThe request was automatically approved, as per your configuration. \n\nThe contract details can be found [here]({})",
                    url,
                )
            }
            NotificationKind::Collateralized => {
                format!(
                    "A borrower has deposited the Bitcoin collateral for one of your loans. It's your turn to disburse the funds. \n\nYou can find the borrower's loan address [here]({})",
                    url,
                )
            }
            NotificationKind::Repaid => {
                format!(
                    "One of your loans has been repaid according to the borrower. You must confirm the repayment in order to release the borrower's collateral. \n\nConfirm the repayment [here]({})",
                    url,
                )
            }
            NotificationKind::Defaulted => {
                format!(
                    "A borrower has defaulted on one of your loans. \n\n Liquidate the collateral [here]({})",
                    url,
                )
            }
            NotificationKind::LiquidationNotice => {
                format!(
                    "A loan is under collateralized. Please log in to liquidate the contract. \n\n[Contract details]({})",
                    url,
                )
            }
            NotificationKind::RequestExpired => {
                format!(
                    "You did not respond in time. We have marked the loan request as expired and marked your loan offer as unavailable. Please log in to create a new offer whenever you are available \n\n[Create New Offer]({})",
                    url,
                )
            }
        };

        match db::telegram_bot::get_chat_ids_by_lender(&self.db, message.lender_id.as_str()).await {
            Ok(chat_ids) => {
                for chat_id in chat_ids
                    .iter()
                    .filter_map(|chat_ids| chat_ids.chat_id.clone())
                {
                    if let Some(sender) = &self.msg_to_user_tx {
                        if let Err(err) = sender.send(build_message(chat_id, text.as_str())).await {
                            tracing::error!("Failed sending message to telegram bot {err:#}");
                        }
                    }
                }
            }
            Err(error) => {
                tracing::error!("Failed loading chat ids for lender {error:#}");
            }
        }
    }
}

fn build_message(chat_id: String, message: &str) -> MessageToUser {
    MessageToUser {
        chat_id,
        // NOTE: when editing a message, please test each and everyone of them. It's very likely
        // you forgot to escape a character and then it fails during runtime!
        // Because of this we are using a function to escape all characters but it might still fail!
        message: escape_markdown_v2(message),
    }
}

pub fn escape_markdown_v2(text: &str) -> String {
    // Characters that need to be escaped in MarkdownV2:
    // '_', '*', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'
    let special_chars = [
        '_', '*', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!',
    ];

    let mut escaped = String::with_capacity(text.len() * 2);
    for c in text.chars() {
        if special_chars.contains(&c) {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    escaped
}
