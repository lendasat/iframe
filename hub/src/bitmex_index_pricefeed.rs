use crate::bitmex_ws_client;
use crate::bitmex_ws_client::Event;
use anyhow::Result;
use futures::TryStreamExt;
use rust_decimal::Decimal;
use serde::Serialize;
use time::OffsetDateTime;
use tokio::sync::mpsc;

#[derive(Debug, Serialize)]
pub struct BitmexIndexPrice {
    #[serde(with = "rust_decimal::serde::float")]
    pub market_price: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub timestamp: OffsetDateTime,
}

pub async fn subscribe_index_price(txs: [mpsc::Sender<BitmexIndexPrice>; 2]) -> Result<()> {
    tokio::spawn(async move {
        let mut stream = bitmex_ws_client::stream(bitmex_stream::Network::Mainnet).await;
        loop {
            match stream.try_next().await {
                Ok(Some(Event::Instrument { data, .. })) => {
                    for instrument in data {
                        for tx in &txs {
                            if let Err(err) = tx
                                .send(BitmexIndexPrice {
                                    market_price: instrument.market_price,
                                    timestamp: instrument.timestamp,
                                })
                                .await
                            {
                                tracing::error!("Failed to notify channel about update {err:#}");
                                continue;
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Closing BitMEX WS after encountering error: {e:#}");
                    break;
                }
                Ok(None) => {
                    tracing::error!("BitMEX WS closed");
                    break;
                }
            }
        }
    });
    Ok(())
}
