use anyhow::Result;
use std::sync::Once;
use telegram_bot::DetailsButton;
use telegram_bot::MessageToUser;
use telegram_bot::TelegramBot;
use telegram_bot::TelegramResponse;
use tokio::sync::mpsc;
use url::Url;

const TELEGRAM_BOT_TOKEN: &str = "token";

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
                        chat_id: register.id.clone(),
                        message: format!(
                            "Welcome\\! Your are registered: {} [details]({})",
                            register.token, "www.test.com"
                        ),
                        details: Some(DetailsButton {
                            title: "Click me".to_string(),
                            url: Url::parse("https://testing.com").expect("to be valid"),
                        }),
                    };

                    if let Err(e) = msg_tx.send(response).await {
                        tracing::error!("Failed to send welcome message: {e:#}");
                    }
                }
                TelegramResponse::Unregister(unregister) => {
                    let response = MessageToUser {
                        chat_id: unregister.id.clone(),
                        message: "You won't receive any more updated".to_string(),
                        details: None,
                    };

                    if let Err(e) = msg_tx.send(response).await {
                        tracing::error!("Failed to send unregister message: {e:#}");
                    }
                }
            }
        }
    });

    let bot = TelegramBot::new(TELEGRAM_BOT_TOKEN, register_tx);
    bot.start(msg_to_user_rx).await;

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
