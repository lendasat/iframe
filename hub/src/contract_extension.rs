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
    LoanOfferLenderMissmatch,
    /// We failed at calculating interest rate
    InterestRateCalculation(anyhow::Error),
    /// No origination fee configured.
    MissingOriginationFee,
    /// Failed to calculate origination fee in sats.
    OriginationFeeCalculation(anyhow::Error),
    /// Can't do much of anything without lender Xpub.
    MissingLenderXpub,
}

// TODO: error handling
pub async fn request_contract_extension(
    pool: &Pool<Postgres>,
    config: &Config,
    original_contract_id: &str,
    new_offer_id: &str,
    borrower_id: &str,
    extended_duration: i32,
    current_price: Decimal,
) -> Result<Contract, Error> {
    let contract = db::contracts::load_contract_by_contract_id_and_borrower_id(
        pool,
        original_contract_id,
        borrower_id,
    )
    .await
    .context("failed loading contract from db")
    .map_err(Error::Database)?;

    let new_offer = db::loan_offers::loan_by_id(pool, new_offer_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::MissingLoanOffer {
            offer_id: new_offer_id.to_string(),
        })?;

    if contract.lender_id != new_offer.lender_id {
        // We do not support this at the moment
        return Err(Error::LoanOfferLenderMissmatch);
    }

    let mut db_tx = pool
        .begin()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    // TODO: we might want a different origination fee if a user extends his loan, for now it's the
    // same again
    let new_origination_fee = config
        .origination_fee
        .first()
        .ok_or(Error::MissingOriginationFee)?;

    let new_origination_fee =
        calculate_origination_fee(contract.loan_amount, new_origination_fee.fee, current_price)
            .map_err(Error::OriginationFeeCalculation)?;

    // The origination fee of the new contract is the original origination fee + the origination fee
    // to extend the contract this is because the original contract has not beem paid back yet
    // and this is basically a new loan
    let new_origination_fee = contract.origination_fee_sats + new_origination_fee.to_sat();

    let new_total_duration = extended_duration + contract.duration_months;
    let new_contract = db::contracts::insert_extension_contract_request(
        &mut db_tx,
        Uuid::new_v4(),
        contract.borrower_id.as_str(),
        contract.lender_id.as_str(),
        new_offer.id.as_str(),
        contract.initial_ltv,
        contract.initial_collateral_sats,
        contract.collateral_sats,
        new_origination_fee,
        contract.loan_amount,
        new_total_duration,
        contract.borrower_btc_address,
        contract.borrower_pk,
        contract.borrower_loan_address.as_str(),
        contract.integration,
        contract.contract_version,
        new_offer.auto_accept,
        contract.lender_xpub.ok_or(Error::MissingLenderXpub)?,
        contract.created_at,
        contract.contract_address,
        contract.contract_index,
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

    db_tx
        .commit()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    Ok(new_contract)
}

/// Calculates the new interest rate with a simple formula:
///
/// = (Initial Interest Rate (p.a.) * Initial Duration (months)) + (Extension Interest Rate (p.a.) *
/// Extension Duration (months))) / (Initial Duration (months) + Extension Duration (months))
pub fn calculate_new_interest_rate(
    initial_interest_rate: Decimal,
    initial_duration: i32,
    extension_interest_rate: Decimal,
    extension_duration: i32,
) -> Result<Decimal> {
    let initial_duration = Decimal::from(initial_duration);
    let extension_duration = Decimal::from(extension_duration);

    let old_rate_per_duration = initial_interest_rate
        .checked_mul(initial_duration)
        .context("failed multiplying old duration and old interest")?;
    let new_rate_per_duration = extension_interest_rate
        .checked_mul(extension_duration)
        .context("failed multiplying new duration and new interest")?;
    let total_duration = initial_duration
        .checked_add(extension_duration)
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
