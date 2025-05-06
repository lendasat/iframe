use crate::config::Config;
use crate::contract_requests::calculate_origination_fee;
use crate::db;
use crate::model::Contract;
use crate::model::ExtensionRequestError;
use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

pub enum Error {
    /// Failed to interact with the database.
    Database(anyhow::Error),
    /// We failed at calculating interest rate
    InterestRateCalculation(anyhow::Error),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(anyhow::Error),
    /// Extension is not currently supported for this contract.
    NotAllowed,
    /// Extension will be possible at a later time.
    TooSoon,
    /// Extension is only possible for `max_duration_days`.
    TooManyDays { max_duration_days: u64 },
}

pub async fn request_contract_extension(
    pool: &Pool<Postgres>,
    config: &Config,
    original_contract_id: &str,
    borrower_id: &str,
    extended_duration_days: i32,
    current_price: Decimal,
) -> Result<Contract, Error> {
    let original_contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        pool,
        original_contract_id,
        borrower_id,
    )
    .await
    .context("failed loading contract from db")
    .map_err(Error::Database)?;

    let now = OffsetDateTime::now_utc();

    let extension_interest_rate =
        match original_contract.handle_extension_request(now, extended_duration_days as u64) {
            Ok(rate) => rate,
            Err(ExtensionRequestError::NotAllowed) => return Err(Error::NotAllowed),
            Err(ExtensionRequestError::TooSoon) => return Err(Error::TooSoon),
            Err(ExtensionRequestError::TooManyDays { max_duration_days }) => {
                return Err(Error::TooManyDays { max_duration_days })
            }
        };

    let mut db_tx = pool
        .begin()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    let new_origination_fee = config
        .extension_origination_fee
        .first()
        .ok_or(Error::MissingOriginationFee)?;

    let new_origination_fee = calculate_origination_fee(
        original_contract.loan_amount,
        new_origination_fee.fee,
        current_price,
    )
    .map_err(Error::OriginationFeeCalculation)?;

    // The origination fee of the new contract is the original origination fee + the origination fee
    // to extend the contract. This is because the original contract has not been paid back yet and
    // this is basically a new loan.
    let total_origination_fee =
        original_contract.origination_fee_sats + new_origination_fee.to_sat();

    let interest_rate = calculate_new_interest_rate(
        original_contract.interest_rate,
        original_contract.duration_days,
        extension_interest_rate,
        extended_duration_days,
    )
    .map_err(Error::InterestRateCalculation)?;

    let new_contract_id = Uuid::new_v4();
    let new_contract = db::contracts::insert_extension_contract_request(
        &mut db_tx,
        new_contract_id,
        original_contract,
        total_origination_fee,
        extended_duration_days,
        interest_rate,
    )
    .await
    .map_err(Error::Database)?;

    db::contracts::mark_contract_as_extended(&mut *db_tx, original_contract_id)
        .await
        .map_err(Error::Database)?;

    db::contract_extensions::insert_contract_extension(
        &mut db_tx,
        original_contract_id,
        new_contract.id.as_str(),
    )
    .await
    .map_err(|e| Error::Database(anyhow!(e)))?;

    db::transactions::duplicate_transactions(
        &mut *db_tx,
        original_contract_id,
        new_contract.id.as_str(),
    )
    .await
    .map_err(|e| Error::Database(anyhow!(e)))?;

    db_tx
        .commit()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    Ok(new_contract)
}

/// Calculates the new interest rate with a simple formula:
///
/// = (Initial Interest Rate (p.a.) * Initial Duration (days)) + (Extension Interest Rate (p.a.) *
/// Extension Duration (days))) / (Initial Duration (days) + Extension Duration (days))
pub fn calculate_new_interest_rate(
    initial_interest_rate: Decimal,
    initial_duration_days: i32,
    extension_interest_rate: Decimal,
    extension_duration_days: i32,
) -> Result<Decimal> {
    let initial_duration_days = Decimal::from(initial_duration_days);
    let extension_duration_days = Decimal::from(extension_duration_days);

    let old_rate_per_duration = initial_interest_rate
        .checked_mul(initial_duration_days)
        .context("failed multiplying old duration and old interest")?;
    let new_rate_per_duration = extension_interest_rate
        .checked_mul(extension_duration_days)
        .context("failed multiplying new duration and new interest")?;
    let total_duration = initial_duration_days
        .checked_add(extension_duration_days)
        .context("failed adding up old duration and new duration")?;

    Ok((old_rate_per_duration + new_rate_per_duration) / total_duration)
}

#[cfg(test)]
pub mod tests {
    use crate::contract_extension::calculate_new_interest_rate;
    use rust_decimal_macros::dec;

    #[test]
    pub fn test_average_interest_rate() {
        let new_rate = calculate_new_interest_rate(dec!(0.12), 3, dec!(0.18), 3).unwrap();
        assert_eq!(new_rate, dec!(0.15));

        let new_rate = calculate_new_interest_rate(dec!(0.24), 18, dec!(0.10), 2).unwrap();
        assert_eq!(new_rate, dec!(0.226));
    }
}
