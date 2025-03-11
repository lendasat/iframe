use rust_decimal::Decimal;
use rust_decimal_macros::dec;

mod contract_liquidation;
mod discounted_origination_fee;
mod user_stats;

pub mod approve_contract;
pub mod bitmex_index_price_rest;
pub mod bitmex_index_pricefeed;
pub mod bitmex_ws_client;
pub mod config;
pub mod contract_approval_expired;
pub mod contract_close_to_expiry;
pub mod contract_default;
pub mod contract_extension;
pub mod contract_request_expiry;
pub mod contract_requests;
pub mod db;
pub mod expiry;
pub mod liquidation_engine;
pub mod logger;
pub mod mempool;
pub mod model;
pub mod moon;
pub mod notifications;
pub mod routes;
pub mod sideshift;
pub mod take_loan_application;
pub mod telegram_bot;
pub mod utils;
pub mod wallet;

pub const LTV_THRESHOLD_MARGIN_CALL_1: Decimal = dec!(0.8);
pub const LTV_THRESHOLD_MARGIN_CALL_2: Decimal = dec!(0.85);
pub const LTV_THRESHOLD_LIQUIDATION: Decimal = dec!(0.9);
pub const LEGACY_LTV_THRESHOLD_LIQUIDATION: Decimal = dec!(0.95);
