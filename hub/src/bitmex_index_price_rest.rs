use rust_decimal::Decimal;
use time::ext::NumericalDuration;
use time::format_description;
use time::OffsetDateTime;

pub async fn get_bitmex_index_price(timestamp: OffsetDateTime) -> anyhow::Result<Decimal> {
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

    let time_format = format_description::parse("[year]-[month]-[day] [hour]:[minute]")?;

    // Ideally we get the price indicated by `timestamp`, but if it is not available we are happy to
    // take a price up to 1 minute in the past.
    let start_time = (timestamp - 1.minutes()).format(&time_format)?;
    let end_time = timestamp.format(&time_format)?;

    let mut url = reqwest::Url::parse("https://www.bitmex.com/api/v1/instrument/compositeIndex")?;
    url.query_pairs_mut()
        .append_pair("symbol", ".BXBT")
        .append_pair(
            "filter",
            // The `reference` is set to `BMI` to get the _composite_ index.

            &format!("{{\"symbol\": \".BXBT\", \"startTime\": \"{start_time}\", \"endTime\": \"{end_time}\", \"reference\": \"BMI\"}}"),
        )
        .append_pair("columns", "lastPrice,timestamp,reference")
        // Reversed to get the latest one.
        .append_pair("reverse", "true")
        // Only need one index.
        .append_pair("count", "1");

    let indices = reqwest::get(url).await?.json::<Vec<Index>>().await?;
    let index = &indices[0];

    let index_price = Decimal::try_from(index.last_price)?;

    Ok(index_price)
}
