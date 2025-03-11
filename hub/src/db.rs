use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::Pool;
use sqlx::Postgres;

pub mod api_account_creator;
pub mod api_keys;
pub mod borrower_features;
pub mod borrowers;
pub mod borrowers_referral_code;
pub mod contract_emails;
pub mod contract_extensions;
pub mod contracts;
pub mod dispute;
pub mod fiat_loan_details;
pub mod invite_code;
pub mod kyc;
pub mod lender_features;
pub mod lenders;
pub mod loan_applications;
pub mod loan_deals;
pub mod loan_offers;
pub mod manual_collateral_recovery;
pub mod moon;
pub(crate) mod sideshift;
pub(crate) mod telegram_bot;
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
