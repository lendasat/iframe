use anyhow::Context;
use serde::Deserialize;

pub async fn is_us_ip(ip: &str) -> anyhow::Result<bool> {
    #[derive(Deserialize)]
    struct GeoInfo {
        country: Option<String>,
    }

    // Local development address can be ignored.
    if ip == "127.0.0.1" {
        return Ok(false);
    }

    let url = format!("https://get.geojs.io/v1/ip/country/{ip}.json");
    let response = reqwest::get(&url).await?;
    let geo_info: GeoInfo = response.json().await?;

    let country_code = geo_info.country.context("Missing country code")?;

    Ok(country_code == "US")
}

pub async fn get_location(ip: &str) -> anyhow::Result<String> {
    #[derive(Deserialize)]
    struct GeoInfo {
        country: Option<String>,
        city: Option<String>,
    }

    // Local development address can be ignored.
    if ip == "127.0.0.1" {
        return Ok("Localhost".to_string());
    }

    let url = format!("https://get.geojs.io/v1/ip/geo/{ip}.json");
    let response = reqwest::get(&url).await?;
    let geo_info: GeoInfo = response.json().await?;

    let location = match (geo_info.country, geo_info.city) {
        (Some(country), Some(city)) => {
            format!("{country}/{city}")
        }
        (None, Some(city)) => city,
        (Some(country), None) => country,
        (None, None) => "unknown".to_string(),
    };

    Ok(location)
}
