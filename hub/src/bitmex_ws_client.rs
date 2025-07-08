use anyhow::anyhow;
use anyhow::Result;
use async_stream::stream;
use bitmex_stream::Network;
use futures::Stream;
use futures::StreamExt;
use futures::TryStreamExt;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::hash::Hash;
use std::time::Duration;
use time::OffsetDateTime;

pub async fn stream(network: Network) -> impl Stream<Item = Result<Event>> + Unpin {
    let stream = stream! {
        let timeout = Duration::from_secs(10);
        let mut stream = bitmex_stream::subscribe(
            ["instrument:.BXBT".to_owned(), "instrument:.BXBTEUR".to_owned()],
            network,
            timeout,
        ).boxed();

        loop {
            match stream.try_next().await {
                Ok(Some(text)) => {
                    tracing::trace!(
                        target : "websocket_message_received",
                        event = text,
                        "Received"
                    );

                    match serde_json::from_str::<wire::TableUpdate>(&text) {
                        Ok(update) => {
                            let event = Event::from(update);

                            tracing::trace!(
                                target: "received_orderbook_event",
                                ?event,
                                "Received new orderbook event",
                            );

                            yield Ok(event);

                        }
                        Err(err) => {
                            tracing::trace!("Unexpected message from BitMEX: {text}, {err:?}");
                        }
                    }
                },
                Err(error) => {
                    yield Err(error);
                }
                Ok(None) => {
                    yield Err(anyhow!("Stream ended"));
                }
            };
        }
    };

    stream.boxed()
}

#[derive(Debug, Clone)]
pub enum Event {
    Instrument {
        action: Action,
        data: Vec<Instrument>,
    },
}

impl From<wire::TableUpdate> for Event {
    fn from(value: wire::TableUpdate) -> Self {
        match value {
            wire::TableUpdate::Instrument { action, data } => Self::Instrument {
                action: action.into(),

                data: data.into_iter().map(|data| data.into()).collect(),
            },
        }
    }
}

impl From<wire::InstrumentData> for Instrument {
    fn from(value: wire::InstrumentData) -> Self {
        Instrument {
            symbol: value.symbol.into(),
            last_price: value.last_price,
            market_price: value.market_price,
            timestamp: value.timestamp,
        }
    }
}

impl From<wire::ContractSymbol> for ContractSymbol {
    fn from(value: wire::ContractSymbol) -> Self {
        match value {
            wire::ContractSymbol::Bxbt => ContractSymbol::BXBT,
            wire::ContractSymbol::BxbtEur => ContractSymbol::BxbtEur,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum Action {
    Insert,
    Update,
    Delete,
    Partial,
}

impl From<wire::BitmexAction> for Action {
    fn from(value: wire::BitmexAction) -> Self {
        match value {
            wire::BitmexAction::Insert => Action::Insert,
            wire::BitmexAction::Delete => Action::Delete,
            wire::BitmexAction::Partial => Action::Partial,
            wire::BitmexAction::Update => Action::Update,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Instrument {
    pub symbol: ContractSymbol,
    pub last_price: Option<Decimal>,
    pub market_price: Option<Decimal>,
    pub timestamp: OffsetDateTime,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Hash, Eq)]
pub enum ContractSymbol {
    #[serde(rename = ".BXBT")]
    BXBT,
    #[serde(rename = ".BXBTEUR")]
    BxbtEur,
}

mod wire {
    use core::fmt;
    use rust_decimal::Decimal;
    use serde::Deserialize;
    use serde::Deserializer;
    use serde::Serialize;
    use time::OffsetDateTime;

    #[derive(Debug)]
    pub enum TableUpdate {
        Instrument {
            action: BitmexAction,
            data: Vec<InstrumentData>,
        },
    }

    #[derive(Debug, Copy, Clone, Deserialize, Serialize, Eq, PartialEq)]
    #[serde(rename_all = "lowercase")]
    pub enum BitmexAction {
        Insert,
        Delete,
        /// After the subscription acknowledgement, you’ll receive a message with "action":
        /// "partial". This is an image of the table, after which you can apply deltas.
        Partial,
        Update,
    }

    #[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
    pub struct InstrumentData {
        pub symbol: ContractSymbol,
        #[serde(rename = "lastPrice")]
        pub last_price: Option<Decimal>,
        #[serde(rename = "markPrice")]
        pub market_price: Option<Decimal>,
        #[serde(with = "time::serde::rfc3339")]
        pub timestamp: OffsetDateTime,
    }

    #[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
    pub enum ContractSymbol {
        #[serde(rename = ".BXBT")]
        Bxbt,
        #[serde(rename = ".BXBTEUR")]
        BxbtEur,
    }

    impl<'de> Deserialize<'de> for TableUpdate {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            struct Visitor;

            impl<'de> serde::de::Visitor<'de> for Visitor {
                type Value = TableUpdate;

                fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                    formatter.write_str("either a table update message")
                }

                fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
                where
                    A: serde::de::MapAccess<'de>,
                {
                    #[derive(Debug)]
                    enum TableUpdateKind {
                        Instrument,
                    }

                    let mut table = None;
                    let mut data = None;
                    let mut action = None;

                    while let Some(key) = map.next_key()? {
                        match key {
                            "table" => {
                                if table.is_some() {
                                    return Err(serde::de::Error::duplicate_field("table"));
                                }

                                let value = match map.next_value()? {
                                    "instrument" => TableUpdateKind::Instrument,
                                    _ => return Err(serde::de::Error::custom("unexpected table")),
                                };

                                table = Some(value);
                            }
                            "action" => {
                                if action.is_some() {
                                    return Err(serde::de::Error::duplicate_field("action"));
                                }
                                let s = map.next_value()?;
                                let action_parsed = match s {
                                    "update" => BitmexAction::Update,
                                    "insert" => BitmexAction::Insert,
                                    "delete" => BitmexAction::Delete,
                                    "partial" => BitmexAction::Partial,
                                    unknown_variant => {
                                        return Err(serde::de::Error::unknown_variant(
                                            unknown_variant,
                                            &["update", "insert", "delete", "partial"],
                                        ));
                                    }
                                };
                                action = Some(action_parsed);
                            }
                            "data" => {
                                if data.is_some() {
                                    return Err(serde::de::Error::duplicate_field("data"));
                                }

                                // `serde_json::RawValue` here so that we can defer the decision of
                                // which concrete type to deserialise into when we've gone through
                                // every key of the map and
                                data = Some(map.next_value::<&serde_json::value::RawValue>()?);
                            }
                            _ => {
                                map.next_value::<serde::de::IgnoredAny>()?;
                            }
                        }
                    }

                    let table = table.ok_or_else(|| serde::de::Error::missing_field("table"))?;
                    let data = data.ok_or_else(|| serde::de::Error::missing_field("data"))?;
                    let action = action.ok_or_else(|| serde::de::Error::missing_field("action"))?;

                    // Now that we know the type of table we're dealing with we can choose between
                    // the variants we support
                    let value = match table {
                        TableUpdateKind::Instrument => TableUpdate::Instrument {
                            action,
                            data: serde_json::from_str::<Vec<InstrumentData>>(data.get()).map_err(
                                |e| {
                                    serde::de::Error::custom(format!(
                                        "could not deserialize orderbook data: {e}"
                                    ))
                                },
                            )?,
                        },
                    };

                    Ok(value)
                }
            }

            deserializer.deserialize_map(Visitor)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bitmex_stream::Network;
    use futures::StreamExt;

    #[tokio::test]
    #[ignore]
    async fn test_real_bitmex_websocket_stream() {
        let mut ws_stream = stream(Network::Mainnet).await;

        match tokio::time::timeout(Duration::from_secs(30), ws_stream.next()).await {
            Ok(Some(Ok(event))) => {
                match event {
                    Event::Instrument { action: _, data } => {
                        assert!(!data.is_empty(), "Should receive instrument data");
                        // Verify we got data for expected symbols
                        for instrument in data {
                            assert!(
                                matches!(
                                    instrument.symbol,
                                    ContractSymbol::BXBT | ContractSymbol::BxbtEur
                                ),
                                "Unexpected symbol: {:?}",
                                instrument.symbol
                            );
                        }
                    }
                }
            }
            Ok(Some(Err(e))) => {
                panic!("Stream error: {e:?}");
            }
            Ok(None) => {
                panic!("Stream ended unexpectedly");
            }
            Err(_) => {
                panic!("Timeout waiting for WebSocket data");
            }
        }
    }
}
