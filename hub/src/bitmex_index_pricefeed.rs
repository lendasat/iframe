use crate::bitmex_ws_client;
use crate::bitmex_ws_client::Event;
use anyhow::Result;
use futures::TryStreamExt;
use rust_decimal::Decimal;
use serde::Serialize;
use std::time::Duration;
use time::OffsetDateTime;
use tokio::sync::mpsc;

#[derive(Debug, Serialize)]
pub struct BitmexIndexPrice {
    #[serde(with = "rust_decimal::serde::float")]
    pub market_price: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub timestamp: OffsetDateTime,
}

const RECONNECTION_TIMEOUT_SECONDS: u64 = 30;

pub async fn subscribe_index_price(txs: [mpsc::Sender<BitmexIndexPrice>; 2]) -> Result<()> {
    tokio::spawn(async move {
        loop {
            let mut stream = bitmex_ws_client::stream(bitmex_stream::Network::Mainnet).await;
            loop {
                match stream.try_next().await {
                    Ok(Some(Event::Instrument { data, .. })) => {
                        for instrument in data {
                            for tx in &txs {
                                if let Some(market_price) = instrument.market_price {
                                    if let Err(err) = tx
                                        .send(BitmexIndexPrice {
                                            market_price,
                                            timestamp: instrument.timestamp,
                                        })
                                        .await
                                    {
                                        tracing::error!(
                                            "Failed to notify channel about update: {err:#}"
                                        );
                                        continue;
                                    }
                                }
                            }
                        }
                    }
                    // In general, losing the connection is not concerning.
                    Err(e) => {
                        tracing::debug!("BitMEX WS disconnected: {e:#}");
                        break;
                    }
                    Ok(None) => {
                        tracing::debug!("BitMEX WS closed");
                        break;
                    }
                }
            }

            tracing::debug!("Reconnecting in {RECONNECTION_TIMEOUT_SECONDS} seconds...");
            tokio::time::sleep(Duration::from_secs(RECONNECTION_TIMEOUT_SECONDS)).await;
        }
    });
    Ok(())
}
