use crate::model::ExtensionPolicy;
use anyhow::Result;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::postgres::PgPoolOptions;
use sqlx::Pool;
use sqlx::Postgres;

pub(crate) mod sideshift;
pub(crate) mod telegram_bot;

pub mod api_account_creator;
pub mod api_keys;
pub mod borrower_features;
pub mod borrowers;
pub mod borrowers_referral_code;
pub mod bringin;
pub mod contract_disputes;
pub mod contract_emails;
pub mod contract_extensions;
pub mod contract_status_log;
pub mod contracts;
pub mod fiat_loan_details;
pub mod invite_code;
pub mod kyc;
pub mod lender_features;
pub mod lenders;
pub mod loan_applications;
pub mod loan_deals;
pub mod loan_offers;
pub mod manual_collateral_recovery;
pub mod migrate_pks;
pub mod moon;
pub mod notifications;
pub mod transactions;
pub mod user_logins;
pub mod user_stats;
pub mod waitlist;
pub mod wallet_backups;
pub mod wallet_index;

pub async fn connect_to_db(db_connection: &str) -> Result<Pool<Postgres>> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(db_connection)
        .await?;
    Ok(pool)
}

pub async fn run_migration(pool: &Pool<Postgres>) -> Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

pub fn map_to_model_extension_policy(
    extension_duration_days: i32,
    extension_interest_rate: Decimal,
) -> ExtensionPolicy {
    match (extension_duration_days, extension_interest_rate) {
        // Zero or negative duration means that the contract may not be extended.
        (duration_days, _) if !duration_days.is_positive() => ExtensionPolicy::DoNotExtend,
        (duration_days, interest_rate) => ExtensionPolicy::AfterHalfway {
            max_duration_days: duration_days as u64,
            // Negative interest rates are not supported.
            interest_rate: interest_rate.max(Decimal::ZERO),
        },
    }
}

pub fn map_to_db_extension_policy(extension_policy: ExtensionPolicy) -> (i32, Decimal) {
    match extension_policy {
        ExtensionPolicy::DoNotExtend => (0, dec!(0.20)),
        ExtensionPolicy::AfterHalfway {
            max_duration_days: duration_days,
            interest_rate,
        } => (duration_days as i32, interest_rate),
    }
}
