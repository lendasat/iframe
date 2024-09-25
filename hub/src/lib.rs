use rust_decimal::Decimal;
use rust_decimal_macros::dec;

pub mod bitmex_index_pricefeed;
pub mod bitmex_ws_client;
pub mod config;
pub mod db;
pub mod email;
pub mod liquidation_engine;
pub mod logger;
pub mod mempool;
pub mod model;
pub mod routes;
pub mod utils;
pub mod wallet;

pub const LTV_THRESHOLD_LIQUIDATION: Decimal = dec!(0.9);
pub const LTV_THRESHOLD_MARGIN_CALL_1: Decimal = dec!(0.7);
pub const LTV_THRESHOLD_MARGIN_CALL_2: Decimal = dec!(0.8);
