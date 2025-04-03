use crate::config::Config;
use crate::contract_requests::calculate_origination_fee;
use crate::db;
use crate::model::Contract;
use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use uuid::Uuid;

pub enum Error {
    /// Failed to interact with the database.
    Database(anyhow::Error),
    /// Referenced loan does not exist.
    MissingLoanOffer { offer_id: String },
    /// Loan offer from different lenders
    LoanOfferLenderMismatch,
    /// We failed at calculating interest rate
    InterestRateCalculation(anyhow::Error),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(anyhow::Error),
}

pub async fn request_contract_extension(
    pool: &Pool<Postgres>,
    config: &Config,
    original_contract_id: &str,
    new_offer_id: &str,
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

    let extension_loan_offer = db::loan_offers::loan_by_id(pool, new_offer_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLoanOffer {
            offer_id: new_offer_id.to_string(),
        })?;

    if original_contract.lender_id != extension_loan_offer.lender_id {
        // We do not support this at the moment
        return Err(Error::LoanOfferLenderMismatch);
    }

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
        extension_loan_offer.interest_rate,
        extended_duration_days,
    )
    .map_err(Error::InterestRateCalculation)?;

    let new_contract_id = Uuid::new_v4();
    let new_contract = db::contracts::insert_extension_contract_request(
        &mut db_tx,
        new_contract_id,
        original_contract,
        &extension_loan_offer,
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
