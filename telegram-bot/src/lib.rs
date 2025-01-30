use teloxide::dispatching::dialogue;
use teloxide::dispatching::dialogue::InMemStorage;
use teloxide::dptree::case;
use teloxide::dptree::deps;
use teloxide::prelude::*;
use teloxide::types::LinkPreviewOptions;
use teloxide::types::ParseMode;
use teloxide::utils::command::BotCommands;
use tokio::sync::mpsc::Receiver;
use tokio::sync::mpsc::Sender;

pub struct TelegramBot {
    inner: Bot,
    internal_message_sender: Sender<TelegramResponse>,
}

#[derive(Clone)] // Make sure it's Clone
struct HandlerDeps {
    sender: Sender<TelegramResponse>,
}

impl TelegramBot {
    pub fn new(token: &str, internal_message_sender: Sender<TelegramResponse>) -> Self {
        Self {
            inner: Bot::new(token),
            internal_message_sender,
        }
    }

    pub async fn start(&self, mut msg_to_user_receiver: Receiver<MessageToUser>) {
        let bot = self.inner.clone();
        // Clone the sender before the closure
        let sender = self.internal_message_sender.clone();

        tokio::spawn({
            let bot = bot.clone();
            async move {
                while let Some(message) = msg_to_user_receiver.recv().await {
                    tracing::debug!(
                        chat_id = message.chat_id,
                        message = message.message,
                        "Sending message to user"
                    );

                    if let Err(err) = bot
                        .send_message(message.chat_id.clone(), message.message)
                        .parse_mode(ParseMode::MarkdownV2)
                        .link_preview_options(LinkPreviewOptions {
                            is_disabled: false,
                            url: None,
                            prefer_small_media: false,
                            prefer_large_media: false,
                            show_above_text: false,
                        })
                        .await
                    {
                        tracing::error!(chat_id = message.chat_id, "Failed notifying user {err:#}")
                    }
                }
            }
        });

        let handler = dialogue::enter::<Update, InMemStorage<State>, State, _>()
            .branch(
                Update::filter_message()
                    .filter_command::<Command>()
                    .branch(case![Command::Start(start)].endpoint(start))
                    .branch(case![Command::Stop].endpoint(stop))
                    .branch(case![Command::Help].endpoint(help)),
            )
            .branch(
                Update::filter_message()
                    .branch(case![State::AskForToken { id }].endpoint(ask_to_register)),
            )
            .branch(
                Update::filter_message()
                    // If a command parsing fails, this handler will not be executed.
                    .endpoint(invalid_command),
            );

        let deps = HandlerDeps { sender };

        Dispatcher::builder(bot, handler)
            .dependencies(deps![InMemStorage::<State>::new(), deps])
            .build()
            .dispatch()
            .await;
    }
}

#[derive(Clone, PartialEq, Debug, Default)]
pub enum State {
    #[default]
    Start,
    AskForToken {
        id: ChatId,
    },
    Stop,
}

#[derive(BotCommands, Clone)]
#[command(
    rename_rule = "lowercase",
    description = "These are the supported commands:"
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

pub type MyDialogue = Dialogue<State, InMemStorage<State>>;
pub type HandlerResult = Result<(), Box<dyn std::error::Error + Send + Sync>>;

async fn start(
    bot: Bot,
    dialogue: MyDialogue,
    msg: Message,
    token: String,
    deps: HandlerDeps,
) -> HandlerResult {
    let sender = deps.sender.clone();
    if token.is_empty() {
        // This means that it is just a regular link like https://t.me/some_bot, or a /start command
        bot.send_message(
            msg.chat.id,
            "G'day!\nPlease provide your token to receive Lendasat updates through this Telegram chat.".to_string(),
        )
        .await?;
        dialogue
            .update(State::AskForToken { id: msg.chat.id })
            .await?;
    } else {
        // And this means that the link is like this: https://t.me/some_bot?start=123456789,
        // or a /start 123456789 command
        tracing::debug!(token, "New user registered");

        if let Err(e) = sender
            .send(TelegramResponse::Register(Register {
                id: msg.chat.id.to_string(),
                token,
            }))
            .await
        {
            tracing::error!("Failed to send registration message: {e:#}");
        }

        dialogue.exit().await?;
    }

    Ok(())
}

async fn ask_to_register(
    bot: Bot,
    msg: Message,
    dialogue: MyDialogue,
    deps: HandlerDeps,
) -> HandlerResult {
    let sender = deps.sender.clone();
    match msg.text() {
        Some(token) => {
            tracing::debug!(token, "New user registered");

            if let Err(e) = sender
                .send(TelegramResponse::Register(Register {
                    id: msg.chat.id.to_string(),
                    token: token.to_string(),
                }))
                .await
            {
                tracing::error!("Failed to send registration message: {e:#}");
            }

            dialogue.exit().await?;
        }
        None => {
            bot.send_message(msg.chat.id, "This bot can send only text.")
                .await?;
        }
    };
    Ok(())
}

async fn stop(msg: Message, dialogue: MyDialogue, deps: HandlerDeps) -> HandlerResult {
    let sender = deps.sender.clone();

    if let Err(e) = sender
        .send(TelegramResponse::Unregister(Unregister {
            id: msg.chat.id.to_string(),
        }))
        .await
    {
        tracing::error!("Failed to send registration message: {e:#}");
    }

    dialogue.exit().await?;
    Ok(())
}

async fn help(bot: Bot, msg: Message) -> HandlerResult {
    bot.send_message(msg.chat.id, Command::descriptions().to_string())
        .await?;
    Ok(())
}

async fn invalid_command(bot: Bot, msg: Message) -> HandlerResult {
    bot.send_message(
        msg.chat.id,
        "Unable to handle the message. Type /help to see all available commands.",
    )
    .await?;
    Ok(())
}

#[derive(Clone, Debug)]
pub struct MessageToUser {
    /// Chat id to send the message to
    pub chat_id: String,
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
