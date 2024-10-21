use crate::model::OriginationFee;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use std::ops::Div;
use std::str::FromStr;

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
}

impl Config {
    pub fn init() -> Config {
        let database_url = std::env::var("DB_URL").expect("DATABASE_URL must be set");
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

        let origination_fee =
            std::env::var("HUB_ORIGINATION_FEE").expect("HUB_ORIGINATION_FEE must be set");
        let orig_fee_parts: Vec<&str> = origination_fee.split(',').collect();
        let start = i32::from_str(orig_fee_parts[0])
            .expect("HUB_ORIGINATION_FEE does not fit format `start,end,fee`");
        let end = i32::from_str(orig_fee_parts[1])
            .expect("HUB_ORIGINATION_FEE does not fit format `start,end,fee`");
        let fee = Decimal::from_str(orig_fee_parts[2])
            .expect("HUB_ORIGINATION_FEE does not fit format `start,end,fee`");
        let fee = fee.div(dec!(100));

        let any_smtp_not_configured = smtp_host.is_none()
            || smtp_port.is_none()
            || smtp_user.is_none()
            || smtp_pass.is_none()
            || smtp_from.is_none();
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
            origination_fee: vec![OriginationFee {
                from_month: start,
                to_month: end,
                fee,
            }],
        }
    }
}
