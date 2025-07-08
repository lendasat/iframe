use anyhow::Context;
use serde::Deserialize;
use std::fmt;

#[derive(Deserialize, Clone)]
pub struct GeoInfo {
    pub country: Option<String>,
    pub city: Option<String>,
}

impl fmt::Display for GeoInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match (&self.country, &self.city) {
            (Some(country), Some(city)) => write!(f, "{country}/{city}"),
            (Some(country), None) => write!(f, "{country}"),
            (None, Some(city)) => write!(f, "{city}"),
            (None, None) => write!(f, "unknown"),
        }
    }
}

pub async fn is_us_ip(ip: &str) -> anyhow::Result<bool> {
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

pub async fn get_geo_info(ip: &str) -> anyhow::Result<GeoInfo> {
    // Local development address can be ignored.
    if ip == "127.0.0.1" {
        return Ok(GeoInfo {
            country: Some("Bitcoin".to_string()),
            city: Some("Genesis".to_string()),
        });
    }

    let url = format!("https://get.geojs.io/v1/ip/geo/{ip}.json");
    let response = reqwest::get(&url).await?;
    let geo_info = response.json().await?;

    Ok(geo_info)
}
