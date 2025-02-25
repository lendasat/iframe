use crate::model::OriginationFee;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use std::ops::Div;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub mempool_rest_url: String,
    pub mempool_ws_url: String,
    pub network: String,
    pub seed_file: String,
    pub fallback_xpub: String,
    pub jwt_secret: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_pass: String,
    pub smtp_from: String,
    pub smtp_disabled: bool,
    pub borrower_frontend_origin: String,
    pub borrower_listen_address: String,
    pub lender_frontend_origin: String,
    pub lender_listen_address: String,
    pub hub_fee_descriptor: String,
    pub hub_fee_wallet_dir: Option<String>,
    pub origination_fee: Vec<OriginationFee>,
    pub extension_origination_fee: Vec<OriginationFee>,
    pub moon_api_key: String,
    pub moon_api_url: String,
    pub moon_webhook_url: String,
    pub moon_visa_product_id: Uuid,
    pub sync_moon_tx: bool,
    pub sideshift_secret: String,
    pub sideshift_base_url: String,
    pub sideshift_affiliate_id: String,
    pub sideshift_commision_rate: Option<Decimal>,
    pub fake_client_ip: Option<String>,
    pub telegram_bot_lender: Option<String>,
}

impl Config {
    pub fn init() -> Config {
        let database_url = std::env::var("DB_URL").expect("DB_URL must be set");
        let mempool_rest_url =
            std::env::var("MEMPOOL_REST_URL").expect("MEMPOOL_REST_URL must be set");
        let mempool_ws_url = std::env::var("MEMPOOL_WS_URL").expect("MEMPOOL_WS_URL must be set");

        let network = std::env::var("NETWORK").expect("NETWORK must be set");

        let seed_file = std::env::var("SEED_FILE").expect("SEED_FILE must be set");
        let fallback_xpub = std::env::var("FALLBACK_XPUB").expect("FALLBACK_XPUB must be set");

        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

        let smtp_host = std::env::var("SMTP_HOST").ok();
        let smtp_port = std::env::var("SMTP_PORT").ok();
        let smtp_user = std::env::var("SMTP_USER").ok();
        let smtp_pass = std::env::var("SMTP_PASS").ok();
        let smtp_from = std::env::var("SMTP_FROM").ok();
        let smtp_disabled = std::env::var("SMTP_DISABLED").ok();

        let borrower_listen_address =
            std::env::var("BORROWER_LISTEN_ADDRESS").expect("BORROWER_LISTEN_ADDRESS must be set");
        let borrower_frontend_origin = std::env::var("BORROWER_FRONTEND_ORIGIN")
            .expect("BORROWER_FRONTEND_ORIGIN must be set");

        let lender_listen_address =
            std::env::var("LENDER_LISTEN_ADDRESS").expect("LENDER_LISTEN_ADDRESS must be set");
        let lender_frontend_origin =
            std::env::var("LENDER_FRONTEND_ORIGIN").expect("LENDER_FRONTEND_ORIGIN must be set");

        let hub_fee_descriptor =
            std::env::var("HUB_FEE_DESCRIPTOR").expect("HUB_FEE_DESCRIPTOR must be set");
        let hub_fee_wallet_dir = std::env::var("HUB_FEE_WALLET_DIR").ok();

        let origination_fee = {
            let data =
                std::env::var("HUB_ORIGINATION_FEE").expect("HUB_ORIGINATION_FEE must be set");
            let parts: Vec<&str> = data.split(',').collect();
            let start = i32::from_str(parts[0])
                .expect("HUB_ORIGINATION_FEE does not fit format `start,end,fee`");
            let end = i32::from_str(parts[1])
                .expect("HUB_ORIGINATION_FEE does not fit format `start,end,fee`");
            let fee = Decimal::from_str(parts[2])
                .expect("HUB_ORIGINATION_FEE does not fit format `start,end,fee`");
            let fee = fee.div(dec!(100));

            vec![OriginationFee {
                from_day: start,
                to_day: end,
                fee,
            }]
        };

        let extension_origination_fee = {
            let data = std::env::var("HUB_EXTENSION_ORIGINATION_FEE")
                .expect("HUB_EXTENSION_ORIGINATION_FEE must be set");
            let parts: Vec<&str> = data.split(',').collect();
            let start = i32::from_str(parts[0])
                .expect("HUB_EXTENSION_ORIGINATION_FEE does not fit format `start,end,fee`");
            let end = i32::from_str(parts[1])
                .expect("HUB_EXTENSION_ORIGINATION_FEE does not fit format `start,end,fee`");
            let fee = Decimal::from_str(parts[2])
                .expect("HUB_EXTENSION_ORIGINATION_FEE does not fit format `start,end,fee`");
            let fee = fee.div(dec!(100));

            vec![OriginationFee {
                from_day: start,
                to_day: end,
                fee,
            }]
        };

        let moon_api_key = std::env::var("MOON_API_KEY").expect("MOON_API_KEY must be set");
        let moon_api_url = std::env::var("MOON_API_URL").expect("MOON_API_URL must be set");
        let moon_visa_product_id =
            std::env::var("MOON_VISA_PRODUCT_ID").expect("MOON_VISA_PRODUCT_ID must be set");
        let moon_visa_product_id = moon_visa_product_id
            .parse()
            .expect("MOON_VISA_PRODUCT_ID to be a UUID");
        let moon_webhook_url =
            std::env::var("MOON_WEBHOOK_URL").expect("MOON_WEBHOOK_URL must be set");

        let sync_moon_tx = std::env::var("MOON_SYNC_TX").ok();
        let sync_moon_tx = sync_moon_tx
            .map(|sync| bool::from_str(sync.as_str()).unwrap_or_default())
            .unwrap_or_default();

        let any_smtp_not_configured = smtp_host.is_none()
            || smtp_port.is_none()
            || smtp_user.is_none()
            || smtp_pass.is_none()
            || smtp_from.is_none();

        let sideshift_secret =
            std::env::var("SIDESHIFT_SECRET").expect("SIDESHIFT_SECRET must be set");
        let sideshift_affiliate_id =
            std::env::var("SIDESHIFT_AFFILIATE_ID").expect("SIDESHIFT_AFFILIATE_ID must be set");
        let sideshift_base_url =
            std::env::var("SIDESHIFT_API_BASE_URL").expect("SIDESHIFT_API_BASE_URL must be set");
        let sideshift_commision_rate = std::env::var("SIDESHIFT_COMMISSION_RATE").ok();
        let sideshift_commision_rate = sideshift_commision_rate
            .map(|rate| Decimal::from_str(rate.as_str()).expect("to be a decimal"));
        let fake_client_ip = std::env::var("FAKE_CLIENT_IP").ok();
        let telegram_bot_lender = std::env::var("TELEGRAM_TOKEN_LENDER").ok();

        Config {
            database_url,
            mempool_rest_url,
            mempool_ws_url,
            network,
            seed_file,
            fallback_xpub,
            jwt_secret,
            smtp_host: smtp_host.unwrap_or_default(),
            smtp_pass: smtp_pass.unwrap_or_default(),
            smtp_user: smtp_user.unwrap_or_default(),
            smtp_port: smtp_port
                .map(|port| port.parse::<u16>().expect("to be able to parse"))
                .unwrap_or_default(),
            smtp_from: smtp_from.unwrap_or_default(),
            borrower_listen_address,
            borrower_frontend_origin,
            lender_listen_address,
            lender_frontend_origin,
            smtp_disabled: any_smtp_not_configured
                || smtp_disabled
                    .map(|disabled| disabled.parse::<bool>().expect("to be able to parse"))
                    .unwrap_or_default(),
            hub_fee_descriptor,
            hub_fee_wallet_dir,
            origination_fee,
            extension_origination_fee,
            moon_api_key,
            moon_api_url,
            moon_webhook_url,
            moon_visa_product_id,
            sync_moon_tx,
            sideshift_secret,
            sideshift_base_url,
            sideshift_affiliate_id,
            sideshift_commision_rate,
            fake_client_ip,
            telegram_bot_lender,
        }
    }
}
