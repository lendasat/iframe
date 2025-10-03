use crate::model::Npub;
use crate::model::OriginationFee;
use bitcoin::Network;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use std::fmt;
use std::fmt::Formatter;
use std::ops::Div;
use std::str::FromStr;
use url::Url;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub network: Network,
    pub use_fake_price: bool,
    pub seed_file: String,
    pub fallback_xpub: String,
    pub jwt_secret: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_pass: String,
    pub smtp_from: String,
    pub smtp_disabled: bool,
    pub borrower_frontend_origin: Url,
    pub borrower_listen_address: String,
    pub lender_frontend_origin: Url,
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
    pub telegram_bot_token: Option<String>,
    pub custom_db_migration: bool,
    pub bringin_url: Url,
    pub bringin_api_secret: String,
    pub bringin_api_key: String,
    pub bringin_webhook_url: Url,
    pub etherscan_api_key: String,
    pub fallback_npub: Npub,
    pub card_topup_fee: Decimal,
    pub esplora_urls: Vec<Url>,
    pub btsieve_sync_interval: u64,
    pub reset_tx_view_in_db: bool,
}

impl fmt::Display for Config {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        writeln!(f, "Config {{")?;

        // Pattern match to ensure all fields are handled
        // This will cause a compile error if a field is added but not handled here
        let Config {
            database_url: _database_url,
            network,
            use_fake_price,
            seed_file: _seed_file,
            fallback_xpub: _fallback_xpub,
            jwt_secret: _jwt_secret,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_pass: _smtp_pass,
            smtp_from,
            smtp_disabled,
            borrower_frontend_origin,
            borrower_listen_address,
            lender_frontend_origin,
            lender_listen_address,
            hub_fee_descriptor,
            hub_fee_wallet_dir,
            origination_fee,
            extension_origination_fee,
            moon_api_key: _moon_api_key,
            moon_api_url,
            moon_webhook_url,
            moon_visa_product_id,
            sync_moon_tx,
            sideshift_secret: _sideshift_secret,
            sideshift_base_url,
            sideshift_affiliate_id,
            sideshift_commision_rate,
            fake_client_ip,
            telegram_bot_token: _telegram_bot_token,
            custom_db_migration,
            bringin_url,
            bringin_api_secret: _bringin_api_secret,
            bringin_api_key: _bringin_api_key,
            bringin_webhook_url,
            etherscan_api_key: _etherscan_api_key,
            fallback_npub,
            card_topup_fee,
            esplora_urls,
            btsieve_sync_interval,
            reset_tx_view_in_db,
        } = self;

        writeln!(f, "  database_url: ***redacted***")?;
        writeln!(f, "  seed_file: ***redacted***")?;
        writeln!(f, "  fallback_xpub: ***redacted***")?;
        writeln!(f, "  jwt_secret: ***redacted***")?;
        writeln!(f, "  smtp_user: {smtp_user}")?;
        writeln!(f, "  smtp_pass: ***redacted***")?;
        writeln!(f, "  hub_fee_descriptor: {hub_fee_descriptor}")?;
        writeln!(f, "  moon_api_key: ***redacted***")?;
        writeln!(f, "  sideshift_secret: ***redacted***")?;
        writeln!(f, "  telegram_bot_token: ***redacted***")?;
        writeln!(f, "  bringin_api_secret: ***redacted***")?;
        writeln!(f, "  bringin_api_key: ***redacted***")?;
        writeln!(f, "  etherscan_api_key: ***redacted***")?;
        writeln!(f, "  network: {network}")?;
        writeln!(f, "  use_fake_price: {use_fake_price}")?;
        writeln!(f, "  smtp_host: {smtp_host}")?;
        writeln!(f, "  smtp_port: {smtp_port}")?;
        writeln!(f, "  smtp_from: {smtp_from}")?;
        writeln!(f, "  smtp_disabled: {smtp_disabled}")?;
        writeln!(f, "  borrower_frontend_origin: {borrower_frontend_origin}")?;
        writeln!(f, "  borrower_listen_address: {borrower_listen_address}")?;
        writeln!(f, "  lender_frontend_origin: {lender_frontend_origin}")?;
        writeln!(f, "  lender_listen_address: {lender_listen_address}")?;
        writeln!(f, "  hub_fee_wallet_dir: {hub_fee_wallet_dir:?}")?;
        writeln!(f, "  origination_fee: {origination_fee:?}")?;
        writeln!(
            f,
            "  extension_origination_fee: {extension_origination_fee:?}"
        )?;
        writeln!(f, "  moon_api_url: {moon_api_url}")?;
        writeln!(f, "  moon_webhook_url: {moon_webhook_url}")?;
        writeln!(f, "  moon_visa_product_id: {moon_visa_product_id}")?;
        writeln!(f, "  sync_moon_tx: {sync_moon_tx}")?;
        writeln!(f, "  sideshift_base_url: {sideshift_base_url}")?;
        writeln!(f, "  sideshift_affiliate_id: {sideshift_affiliate_id}")?;
        writeln!(
            f,
            "  sideshift_commision_rate: {sideshift_commision_rate:?}"
        )?;
        writeln!(f, "  fake_client_ip: {fake_client_ip:?}")?;
        writeln!(f, "  custom_db_migration: {custom_db_migration}")?;
        writeln!(f, "  bringin_url: {bringin_url}")?;
        writeln!(f, "  bringin_webhook_url: {bringin_webhook_url}")?;
        writeln!(f, "  fallback_npub: {fallback_npub}")?;
        writeln!(f, "  card_topup_fee: {card_topup_fee}")?;
        writeln!(f, "  esplora_urls: {esplora_urls:?}")?;
        writeln!(f, "  btsieve_sync_interval: {btsieve_sync_interval}")?;
        writeln!(f, "  reset_tx_view_in_db: {reset_tx_view_in_db}")?;

        write!(f, "}}")
    }
}

impl Config {
    pub fn init() -> Config {
        let database_url = std::env::var("DB_URL").expect("DB_URL must be set");

        let network = std::env::var("NETWORK").expect("NETWORK must be set");
        let network = Network::from_str(&network).expect("Invalid Bitcoin network");

        let use_fake_price = {
            let value = std::env::var("USE_FAKE_PRICE").ok();
            let value = value.map(|v| bool::from_str(v.as_ref()).unwrap_or_default());

            value.unwrap_or_default()
        };

        let custom_db_migration = {
            let value = std::env::var("CUSTOM_DB_MIGRATION").ok();
            let value = value.map(|v| bool::from_str(v.as_ref()).unwrap_or_default());

            value.unwrap_or_default()
        };

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
        let borrower_frontend_origin =
            Url::parse(borrower_frontend_origin.as_str()).expect("to be a valid url");

        let lender_listen_address =
            std::env::var("LENDER_LISTEN_ADDRESS").expect("LENDER_LISTEN_ADDRESS must be set");
        let lender_frontend_origin =
            std::env::var("LENDER_FRONTEND_ORIGIN").expect("LENDER_FRONTEND_ORIGIN must be set");
        let lender_frontend_origin =
            Url::parse(lender_frontend_origin.as_str()).expect("to be a valid url");

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
        let telegram_bot_token = std::env::var("TELEGRAM_TOKEN").ok();

        let bringin_url = std::env::var("BRINGIN_URL").expect("BRINGIN_URL must be set");
        let bringin_url = Url::parse(bringin_url.as_str()).expect("to be a valid URL");

        let bringin_api_secret =
            std::env::var("BRINGIN_API_SECRET").expect("BRINGIN_API_SECRET must be set");
        let bringin_api_key =
            std::env::var("BRINGIN_API_KEY").expect("BRINGIN_API_KEY must be set");

        let bringin_webhook_url =
            std::env::var("BRINGIN_WEBHOOK_URL").expect("BRINGIN_WEBHOOK_URL must be set");
        let bringin_webhook_url =
            Url::parse(bringin_webhook_url.as_str()).expect("to be a valid URL");

        let etherscan_api_key =
            std::env::var("ETHERSCAN_API_KEY").expect("ETHERSCAN_API_KEY must be set");

        let fallback_npub = std::env::var("FALLBACK_NPUB").expect("FALLBACK_NPUB must be set");
        let fallback_npub = fallback_npub.parse().expect("valid Npub");

        let card_topup_fee =
            std::env::var("MOON_CARD_TOPUP_FEE").expect("MOON_CARD_TOPUP_FEE must be set");
        let card_topup_fee = Decimal::from_str(card_topup_fee.as_str()).expect("to be a decimal");

        let btsieve_sync_interval =
            std::env::var("BTSIEVE_SYNC_INTERVAL").expect("BTSIEVE_SYNC_INTERVAL must be set");
        let btsieve_sync_interval =
            u64::from_str(btsieve_sync_interval.as_str()).expect("to be a number");

        let esplora_urls_strings = std::env::var("ESPLORA_URLS").expect("ESPLORA_URLS must be set");
        let esplora_urls_strings = esplora_urls_strings.split(",");
        let mut esplora_urls = vec![];
        for url in esplora_urls_strings {
            let url = Url::parse(url).expect("to be a valid URL");
            esplora_urls.push(url);
        }

        let reset_tx_view_in_db = {
            let value = std::env::var("ESPLORA_RESET_TX").ok();
            let value = value.map(|v| bool::from_str(v.as_ref()).unwrap_or_default());

            value.unwrap_or_default()
        };

        Config {
            database_url,
            network,
            use_fake_price,
            seed_file,
            fallback_xpub,
            jwt_secret,
            smtp_host: smtp_host.unwrap_or_default(),
            smtp_port: smtp_port
                .map(|port| port.parse::<u16>().expect("to be able to parse"))
                .unwrap_or_default(),
            smtp_user: smtp_user.unwrap_or_default(),
            smtp_pass: smtp_pass.unwrap_or_default(),
            smtp_from: smtp_from.unwrap_or_default(),
            smtp_disabled: any_smtp_not_configured
                || smtp_disabled
                    .map(|disabled| disabled.parse::<bool>().expect("to be able to parse"))
                    .unwrap_or_default(),
            borrower_frontend_origin,
            borrower_listen_address,
            lender_frontend_origin,
            lender_listen_address,
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
            telegram_bot_token,
            custom_db_migration,
            bringin_url,
            bringin_api_secret,
            bringin_api_key,
            bringin_webhook_url,
            etherscan_api_key,
            fallback_npub,
            card_topup_fee,
            esplora_urls,
            btsieve_sync_interval,
            reset_tx_view_in_db,
        }
    }
}
