use crate::config::Config;
use crate::model::LoanAsset;
use anyhow::Context;
use rust_decimal::Decimal;
use std::fmt;
use std::fmt::Formatter;
use time::ext::NumericalDuration;
use time::format_description;
use time::OffsetDateTime;

enum BitmexIndex {
    BxbtUsd,
    BxbtEur,
}

impl fmt::Display for BitmexIndex {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            BitmexIndex::BxbtUsd => f.write_str(".BXBT"),
            BitmexIndex::BxbtEur => f.write_str(".BXBTEUR"),
        }
    }
}

impl From<LoanAsset> for BitmexIndex {
    fn from(value: LoanAsset) -> Self {
        match value {
            LoanAsset::UsdcPol
            | LoanAsset::UsdtPol
            | LoanAsset::UsdcEth
            | LoanAsset::UsdtEth
            | LoanAsset::UsdcStrk
            | LoanAsset::UsdtStrk
            | LoanAsset::UsdcSol
            | LoanAsset::UsdtSol
            | LoanAsset::Usd
            | LoanAsset::Chf
            | LoanAsset::Mxn
            | LoanAsset::UsdtLiquid => BitmexIndex::BxbtUsd,
            LoanAsset::Eur => BitmexIndex::BxbtEur,
        }
    }
}

pub async fn get_bitmex_index_price(
    config: &Config,
    timestamp: OffsetDateTime,
    asset: LoanAsset,
) -> anyhow::Result<Decimal> {
    #[cfg(debug_assertions)]
    {
        use bitcoin::Network;
        use rust_decimal_macros::dec;

        if !matches!(config.network, Network::Bitcoin) && config.use_fake_price {
            return Ok(dec!(80_000));
        }
    }

    let index = BitmexIndex::from(asset);

    let time_format = format_description::parse("[year]-[month]-[day] [hour]:[minute]")?;

    // Ideally we get the price indicated by `timestamp`, but if it is not available we are happy to
    // take a price up to 1 minute in the past.
    let start_time = (timestamp - 1.minutes()).format(&time_format)?;
    let end_time = timestamp.format(&time_format)?;

    let mut url = reqwest::Url::parse("https://www.bitmex.com/api/v1/instrument/compositeIndex")?;
    url.query_pairs_mut()
        .append_pair("symbol", index.to_string().as_str())
        .append_pair(
            "filter",
            // The `reference` is set to `BMI` to get the _composite_ index.

            &format!("{{\"symbol\": \"{index}\", \"startTime\": \"{start_time}\", \"endTime\": \"{end_time}\", \"reference\": \"BMI\"}}"),
        )
        .append_pair("columns", "lastPrice,timestamp,reference")
        // Reversed to get the latest one.
        .append_pair("reverse", "true")
        // Only need one index.
        .append_pair("count", "1");

    let indices = reqwest::get(url).await?.json::<Vec<Index>>().await?;
    let index = indices.first().context("Got no index price from BitMEX")?;

    let index_price = Decimal::try_from(index.last_price)?;

    Ok(index_price)
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Index {
    #[serde(with = "time::serde::rfc3339")]
    #[serde(rename = "timestamp")]
    _timestamp: OffsetDateTime,
    last_price: f64,
    #[serde(rename = "reference")]
    _reference: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::LoanAsset;
    use crate::model::OriginationFee;
    use bitcoin::Network;
    use rust_decimal_macros::dec;
    use time::macros::datetime;
    use uuid::Uuid;

    fn create_test_config(use_fake_price: bool, network: Network) -> Config {
        Config {
            database_url: "test".to_string(),
            mempool_rest_url: "test".to_string(),
            mempool_ws_url: "test".to_string(),
            network,
            use_fake_price,
            seed_file: "test".to_string(),
            fallback_xpub: "test".to_string(),
            jwt_secret: "test".to_string(),
            smtp_host: "test".to_string(),
            smtp_port: 587,
            smtp_user: "test".to_string(),
            smtp_pass: "test".to_string(),
            smtp_from: "test".to_string(),
            smtp_disabled: true,
            borrower_frontend_origin: url::Url::parse("http://localhost:3000").unwrap(),
            borrower_listen_address: "0.0.0.0:3000".to_string(),
            lender_frontend_origin: url::Url::parse("http://localhost:3001").unwrap(),
            lender_listen_address: "0.0.0.0:3001".to_string(),
            hub_fee_descriptor: "test".to_string(),
            hub_fee_wallet_dir: None,
            origination_fee: vec![OriginationFee {
                from_day: 1,
                to_day: 365,
                fee: dec!(0.01),
            }],
            extension_origination_fee: vec![OriginationFee {
                from_day: 1,
                to_day: 365,
                fee: dec!(0.01),
            }],
            moon_api_key: "test".to_string(),
            moon_api_url: "test".to_string(),
            moon_webhook_url: "test".to_string(),
            moon_visa_product_id: Uuid::new_v4(),
            sync_moon_tx: false,
            sideshift_secret: "test".to_string(),
            sideshift_base_url: "test".to_string(),
            sideshift_affiliate_id: "test".to_string(),
            sideshift_commision_rate: None,
            fake_client_ip: None,
            telegram_bot_token: None,
            custom_db_migration: false,
            bringin_url: url::Url::parse("http://localhost").unwrap(),
            bringin_api_secret: "test".to_string(),
            bringin_api_key: "test".to_string(),
            bringin_webhook_url: url::Url::parse("http://localhost").unwrap(),
            etherscan_api_key: "test".to_string(),
        }
    }

    #[test]
    fn test_index_deserialization() {
        let json = r#"{
            "timestamp": "2024-01-01T12:00:00.000Z",
            "lastPrice": 45000.5,
            "reference": "BMI"
        }"#;

        let index: Index = serde_json::from_str(json).unwrap();
        assert_eq!(index.last_price, 45000.5);
        assert_eq!(index._reference, "BMI");
        assert_eq!(index._timestamp, datetime!(2024-01-01 12:00:00.000 +00:00));
    }

    #[tokio::test]
    async fn test_fake_price_in_debug_non_bitcoin_network() {
        let config = create_test_config(true, Network::Regtest);
        let timestamp = datetime!(2024-01-01 12:00:00.000 +00:00);

        let result = get_bitmex_index_price(&config, timestamp, LoanAsset::Usd).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), dec!(80_000));
    }

    #[tokio::test]
    #[ignore]
    async fn test_real_bitmex_api_usd_index() {
        let config = create_test_config(false, Network::Bitcoin);
        let timestamp = OffsetDateTime::now_utc();

        let result = get_bitmex_index_price(&config, timestamp, LoanAsset::Usd).await;

        assert!(
            result.is_ok(),
            "Failed to get USD index: {:?}",
            result.err()
        );
        let _price = result.unwrap();
    }

    #[tokio::test]
    #[ignore]
    async fn test_real_bitmex_api_eur_index() {
        let config = create_test_config(false, Network::Bitcoin);
        let timestamp = OffsetDateTime::now_utc();

        let result = get_bitmex_index_price(&config, timestamp, LoanAsset::Eur).await;

        assert!(
            result.is_ok(),
            "Failed to get EUR index: {:?}",
            result.err()
        );
        let _price = result.unwrap();
    }
}
