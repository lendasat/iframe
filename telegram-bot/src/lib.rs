use teloxide::prelude::*;
use teloxide::utils::command::BotCommands;
use tokio::sync::mpsc::{Receiver, Sender};

pub struct TelegramBot {
    inner: Bot,
    internal_message_sender: Sender<TelegramResponse>,
    msg_to_user_receiver: Receiver<MessageToUser>,
}

impl TelegramBot {
    pub fn new(
        token: &str,
        internal_message_sender: Sender<TelegramResponse>,
        msg_to_user_receiver: Receiver<MessageToUser>,
    ) -> Self {
        Self {
            inner: Bot::new(token),
            internal_message_sender,
            msg_to_user_receiver,
        }
    }

    pub async fn start(self) {
        let mut message_to_user_receiver = self.msg_to_user_receiver;
        let bot = self.inner.clone();

        let reg_handle = tokio::spawn(async move {
            while let Some(message) = message_to_user_receiver.recv().await {
                if let Err(err) = bot.send_message(message.id.clone(), message.message).await {
                    tracing::error!(
                        chat_id = message.id,
                        user_id = message.user_id,
                        "Failed notifying user {err:#}"
                    )
                }
            }
        });

        Command::repl(self.inner.clone(), move |bot, msg, cmd| {
            handle_command(bot, msg, cmd, self.internal_message_sender.clone())
        })
        .await;

        if let Err(e) = reg_handle.await {
            tracing::error!("Registration handler failed: {}", e);
        }
    }
}

#[derive(Clone, Debug)]
pub struct MessageToUser {
    /// Chat id to send the message to
    pub id: String,
    /// User id the chat belongs to
    pub user_id: String,
    /// Message to send to the user
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct Register {
    pub id: String,
    pub token: String,
}

#[derive(Clone, Debug)]
pub struct Unregister {
    pub id: String,
}

pub enum TelegramResponse {
    Register(Register),
    Unregister(Unregister),
}

#[derive(BotCommands, Clone)]
#[command(
    rename_rule = "lowercase",
    description = "These commands are supported:"
)]
enum Command {
    #[command(description = "Prints this message.")]
    Help,
    #[command(
        description = "Start receiving notifications. Please provide your telegram token which you can find in your profile."
    )]
    Start(String),
    #[command(description = "Stop receiving notifications.")]
    Stop,
}

async fn handle_command(
    bot: Bot,
    telegram_msg: Message,
    cmd: Command,
    register_sender: Sender<TelegramResponse>,
) -> ResponseResult<()> {
    match cmd {
        Command::Help => {
            bot.send_message(telegram_msg.chat.id, Command::descriptions().to_string())
                .await?;
        }
        Command::Start(id) => {
            if id.is_empty() {
                bot.send_message(
                    telegram_msg.chat.id,
                    r#"Please provide your token like this /start {token}."#,
                )
                .await?;
            } else {
                tracing::debug!("User registered telegram bot");

                if let Err(e) = register_sender
                    .send(TelegramResponse::Register(Register {
                        id: telegram_msg.chat.id.to_string(),
                        token: id,
                    }))
                    .await
                {
                    tracing::error!("Failed to send registration message: {e:#}");
                }
            }
        }
        Command::Stop => {
            if let Err(e) = register_sender
                .send(TelegramResponse::Unregister(Unregister {
                    id: telegram_msg.chat.id.to_string(),
                }))
                .await
            {
                tracing::error!("Failed to send unregister message: {e:#}");
            }
        }
    };

    Ok(())
}
