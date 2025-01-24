use anyhow::Result;
use std::sync::Once;
use telegram_bot::{MessageToUser, TelegramBot, TelegramResponse};
use tokio::sync::mpsc;

const TELEGRAM_BOT_TOKEN: &str = "YOUR_TOKEN";

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();

    let (register_tx, mut register_rx) = mpsc::channel::<TelegramResponse>(100);
    let (msg_to_user_tx, msg_to_user_rx) = mpsc::channel(100);

    let msg_tx = msg_to_user_tx.clone();
    tokio::spawn(async move {
        while let Some(msg) = register_rx.recv().await {
            match msg {
                TelegramResponse::Register(register) => {
                    let response = MessageToUser {
                        id: register.id.clone(),
                        user_id: register.token.clone(),
                        message: format!("Welcome! Your are registered: {}", register.token),
                    };

                    if let Err(e) = msg_tx.send(response).await {
                        tracing::error!("Failed to send welcome message: {e:#}");
                    }
                }
                TelegramResponse::Unregister(unregister) => {
                    let response = MessageToUser {
                        id: unregister.id.clone(),
                        user_id: "Some user id".to_string(),
                        message: "You won't receive any more updated".to_string(),
                    };

                    if let Err(e) = msg_tx.send(response).await {
                        tracing::error!("Failed to send unregister message: {e:#}");
                    }
                }
            }
        }
    });

    let bot = TelegramBot::new(TELEGRAM_BOT_TOKEN, register_tx, msg_to_user_rx);
    bot.start().await;

    Ok(())
}

pub fn init_tracing() {
    static TRACING_TEST_SUBSCRIBER: Once = Once::new();

    TRACING_TEST_SUBSCRIBER.call_once(|| {
        tracing_subscriber::fmt()
            .with_env_filter(
                "debug,\
                 tower=info,\
                 hyper=info",
            )
            .with_test_writer()
            .init()
    })
}
