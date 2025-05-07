use crate::db;
use crate::model::LoanAsset;
use anyhow::anyhow;
use anyhow::bail;
use anyhow::Result;
use bitcoin::hex::Case;
use bitcoin::hex::DisplayHex;
use hmac::Hmac;
use hmac::Mac;
use reqwest::StatusCode;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sha2::Sha256;
use sqlx::Pool;
use sqlx::Postgres;
use std::ops::Div;
use thiserror::Error;
use time::OffsetDateTime;
use url::Url;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Loan asset not supported: {invalid_asset:?}, supported assets: {supported_assets:?}")]
    LoanAssetNotSupported {
        invalid_asset: LoanAsset,
        supported_assets: Vec<LoanAsset>,
    },

    #[error("Database error: {0}")]
    Database(#[from] anyhow::Error),

    #[error("No API key available for user")]
    NoApiKey,

    #[error("Request error: {0}")]
    RequestError(#[from] reqwest::Error),

    #[error("API error: Status {status}, Message: {message}")]
    ApiError { status: StatusCode, message: String },

    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Loan amount {loan_amount} is out of bounds: min={min}, max={max}")]
    LoanAmountOutOfBounds {
        min: Decimal,
        max: Decimal,
        loan_amount: Decimal,
    },
}

#[derive(serde::Deserialize, Debug)]
pub struct GetUserIdResponse {
    #[serde(rename = "userId")]
    pub user_id: String,
}

/// Fetch the user's ID from Bringin
///
/// This will return the UUID of the user associated with the given API key
pub async fn get_user_id(
    bringin_url: Url,
    api_key: &str,
    api_secret: &str,
) -> Result<GetUserIdResponse, Error> {
    let client = reqwest::Client::new();

    let path_auth_header = "/api/v0/user/user-id";
    let auth_header =
        calculate_auth_header::<String>("POST", path_auth_header, None, api_secret, None)?;

    let res = client
        .get(format!("{bringin_url}/user/user-id"))
        .header("api-key", api_key)
        .header("Authorization", auth_header)
        .send()
        .await?;

    // Check if the response is successful
    if !res.status().is_success() {
        let status = res.status();

        // Get the response body as text - this consumes res
        let error_body = res.text().await?;

        return Err(Error::ApiError {
            status,
            message: error_body,
        });
    }

    // Parse the successful response
    let response = res.json::<GetUserIdResponse>().await?;
    Ok(response)
}

// The `bringin_url` is of the form `https://dev.bringin.xyz/api/v0`.
pub async fn get_address(
    pool: &Pool<Postgres>,
    bringin_url: &Url,
    loan_asset: LoanAsset,
    borrower_id: &str,
    borrower_ip: &str,
    loan_amount: Decimal,
) -> Result<String, Error> {
    let supported_assets = vec![LoanAsset::UsdcPol];

    if !supported_assets.contains(&loan_asset) {
        return Err(Error::LoanAssetNotSupported {
            invalid_asset: loan_asset,
            supported_assets,
        });
    }

    let borrower_api_key = db::bringin::get_api_key(pool, borrower_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::NoApiKey)?;

    let res =
        post_usdc_polygon_offramp_address(bringin_url, &borrower_api_key, borrower_ip).await?;

    let max_deposit = res.maximum_deposit_amount_cents.div(dec!(100));
    let min_deposit = res.minimum_deposit_amount_cents.div(dec!(100));

    tracing::info!(
        address = res.address,
        min_deposit = min_deposit.to_string(),
        max_deposit = max_deposit.to_string(),
        "Received address from Bringin"
    );

    if loan_amount > max_deposit || loan_amount < min_deposit {
        return Err(Error::LoanAmountOutOfBounds {
            min: min_deposit,
            max: max_deposit,
            loan_amount,
        });
    }

    Ok(res.address)
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct PostOfframpAddressRequest {
    ip_address: String,
    source_currency: String,
    source_blockchain: String,
}

#[derive(serde::Deserialize, Debug)]
struct PostOfframpAddressResponse {
    /// in cents USDC
    #[serde(with = "rust_decimal::serde::str", rename = "maximumDepositAmount")]
    maximum_deposit_amount_cents: Decimal,
    /// in cents USDC
    #[serde(with = "rust_decimal::serde::str", rename = "minimumDepositAmount")]
    minimum_deposit_amount_cents: Decimal,
    address: String,
}

async fn post_usdc_polygon_offramp_address(
    bringin_url: &Url,
    borrower_api_key: &str,
    borrower_ip: &str,
) -> Result<PostOfframpAddressResponse, Error> {
    let client = reqwest::Client::new();

    let body = PostOfframpAddressRequest {
        ip_address: borrower_ip.to_string(),
        source_currency: "USDC".to_string(),
        source_blockchain: "POLYGON".to_string(),
    };

    let res = client
        .post(format!("{bringin_url}/offramp/address"))
        .header("api-key", borrower_api_key)
        .json(&body)
        .send()
        .await?;

    // Check if the response is successful
    if !res.status().is_success() {
        let status = res.status();

        let error_body = res.text().await?;

        return Err(Error::ApiError {
            status,
            message: error_body,
        });
    }

    // Parse the successful response
    let response = res.json::<PostOfframpAddressResponse>().await?;
    Ok(response)
}

#[derive(serde::Serialize, Debug)]
struct PostApiKeyRequest {
    #[serde(rename = "ref")]
    reference: String,
    callback: Url,
    email: String,
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PostApiKeyResponse {
    pub user_registered: bool,
    #[serde(rename = "signupURL")]
    pub signup_url: Option<Url>,
}

/// Initiate connection with Bringing via Email address
///
/// Flow:
/// Bringin checks if the email is associated with an existing Bringin user.
/// Based on the result:
///
///
/// If the user exists:
///
/// - Bringin sends a co-branded email requesting the user’s consent to establish the connection.
/// - The API response confirms that the user has been invited to approve the connection.
/// - You should prompt the user to check their email and complete the process.
/// - Once the user clicks on “confirm connection link” in the email, you should receive a callback
///   with
///     - Email
///     - Ref
///     - api-key
///
/// If the user does not exist:
/// - Bringin sends a co-branded email inviting the user to onboard with Bringin via a signup link.
/// - The API response includes the same signup link.
/// - You can display this link in your application to guide the user to get started with Bringin.
/// - You will get a webhook when the user completes the KYC with as per webhook docs below.
///     - Ref
///     - api-key
pub async fn post_get_api_key(
    bringin_url: &Url,
    email: &str,
    reference: &str,
    callback_url: Url,
    admin_api_key: &str,
    admin_api_secret: &str,
) -> Result<PostApiKeyResponse> {
    let client = reqwest::Client::new();

    let body = PostApiKeyRequest {
        reference: reference.to_string(),
        callback: callback_url,
        email: email.to_string(),
    };

    let path = "application/connect";
    let path_auth_header = "/api/v0/application/connect";
    let auth_header = calculate_auth_header(
        "POST",
        path_auth_header,
        Some(&body),
        admin_api_secret,
        None,
    )?;

    let req = client
        .post(format!("{bringin_url}/{path}"))
        .header("api-key", admin_api_key)
        .header("Authorization", auth_header)
        .header("Content-Type", "application/json")
        .json(&body);

    let req = req.build()?;

    let res = client.execute(req).await?;

    let status_code = res.status();
    if status_code.is_success() {
        let response = res.json::<PostApiKeyResponse>().await?;
        return Ok(response);
    }
    let body = res.text().await?;
    let http_code = status_code.as_u16();

    tracing::error!(http_code, body, "Failed sending request");
    bail!(format!(
        "Failed sending request. Http code {http_code} and body {body}"
    ))
}

type HmacSha256 = Hmac<Sha256>;

/// Calculates the authorization header for a request
fn calculate_auth_header<T: serde::Serialize>(
    method: &str,
    path: &str,
    body: Option<&T>,
    api_secret: &str,
    unix_timestamp: Option<i64>,
) -> Result<String> {
    // Step 1: Get current timestamp
    let time = unix_timestamp.unwrap_or_else(|| OffsetDateTime::now_utc().unix_timestamp() * 1000);

    // Step 2: Stringify the body
    let body_string = match body {
        Some(b) => serde_json::to_string(b)?,
        None => "{}".to_string(), // Empty JSON object for GET requests
    };

    // Step 3: Calculate MD5 digest of body
    let digest = md5::compute(body_string.as_bytes());
    let content_hash = digest.to_hex_string(Case::Lower);

    #[cfg(debug_assertions)]
    if body.is_none() {
        assert_eq!(content_hash, "99914b932bd37a50b983c5e7c90ae93b".to_string());
    }

    // Step 4: Concatenate timestamp, method, path, and body digest
    let signature_raw_data = format!("{}{}{}{}", time, method, path, content_hash);

    // Step 5: Create HMAC SHA256 digest
    let mut mac = HmacSha256::new_from_slice(api_secret.as_bytes())
        .map_err(|_| anyhow!("HMAC can take key of any size"))?;
    mac.update(signature_raw_data.as_bytes());
    let result = mac.finalize().into_bytes();

    // Convert the result to a hex string
    let signature = result.to_hex_string(Case::Lower);

    // Step 6: Assemble the authorization header
    Ok(format!("HMAC {}:{}", time, signature))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Serialize;
    use std::str::FromStr;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_get_user_id() {
        let bringin_url = "https://dev.bringin.xyz/api/v0";
        let borrower_api_key = "ZDRiOWMzMDZiNjVhNDQ5Y2I2NDE4Nzk0OGI1ZjlhYzU=";
        let lendasat_api_secret =
            "TDIzYUZEOUwzV0ZubkFOVWZHSGYxaGU0OHdYYnd1UEx2c3BRMkFjYzY2RDk4MkpRRWRtbg==";

        let _res = get_user_id(
            bringin_url.parse().unwrap(),
            borrower_api_key,
            lendasat_api_secret,
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn test_post_usdc_polygon_offramp_address() {
        let bringin_url = "https://dev.bringin.xyz/api/v0";
        let borrower_api_key = "ZDRiOWMzMDZiNjVhNDQ5Y2I2NDE4Nzk0OGI1ZjlhYzU=";
        let borrower_ip = "164.90.233.112";

        let _res = post_usdc_polygon_offramp_address(
            &bringin_url.parse().unwrap(),
            borrower_api_key,
            borrower_ip,
        )
        .await
        .unwrap();
    }

    #[test]
    fn test_auth_header_generation() {
        let api_secret = "your_api_secret";

        // POST request example
        let body = serde_json::json!({
            "dummy": 42,
            "data": 21
        });

        // Check if GET request with body does not blow up
        let _auth_header =
            calculate_auth_header("POST", "/ping", Some(&body), api_secret, None).unwrap();

        // Check if GET request with no body does not blow up
        let _auth_header =
            calculate_auth_header::<serde_json::Value>("GET", "/status", None, api_secret, None)
                .unwrap();
    }

    #[test]
    fn test_auth_header_generation_static() {
        let api_secret = "TDIzYUZEOUwzV0ZubkFOVWZHSGYxaGU0OHdYYnd1UEx2c3BRMkFjYzY2RDk4MkpRRWRtbg==";

        #[derive(Serialize)]
        struct Sample {
            reference: String,
            callback: String,
            email: String,
        }

        // POST request example
        let body = Sample {
            reference: "3d1bac50-bed6-4c80-ac91-092140226f7d".to_string(),
            callback: "https://webhook.site/7cd43794-923e-4b4f-9847-be18b9498b90".to_string(),
            email: "7cd43794-923e-4b4f-9847-be18b9498b90@emailhook.site".to_string(),
        };

        let time = Some(1746148768002);

        let auth_header = calculate_auth_header(
            "POST",
            "/api/v0/application/connect",
            Some(&body),
            api_secret,
            time,
        )
        .unwrap();
        assert_eq!(
            auth_header,
            "HMAC 1746148768002:f5e81b6935c372db1cfce607979280852878ba9e587b21ac9260267574729151"
        )
    }

    #[tokio::test]
    async fn test_register_webhook_for_api_key() {
        let bringin_url = "https://dev.bringin.xyz/api/v0";
        let lendasat_api_key = "YmNkMjAwZTZmODZiNDcwYzgwYWQzZjdjNDBlZDZiYjQ=";
        let lendasat_api_secret =
            "TDIzYUZEOUwzV0ZubkFOVWZHSGYxaGU0OHdYYnd1UEx2c3BRMkFjYzY2RDk4MkpRRWRtbg==";

        let reference = Uuid::from_str("3d1bac50-bed6-4c80-ac91-092140226f7d").unwrap();
        post_get_api_key(
            &bringin_url.parse().unwrap(),
            "test86864210@mailinator.com",
            reference.to_string().as_str(),
            "https://webhook.site/2084ca6b-a80a-498b-b6bd-8b4af2d98404"
                .parse()
                .unwrap(),
            lendasat_api_key,
            lendasat_api_secret,
        )
        .await
        .unwrap();
    }
}
