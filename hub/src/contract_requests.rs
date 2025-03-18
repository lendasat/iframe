use anyhow::Context;
use bitcoin_units::Amount;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;

/// Calculates the origination fee in Bitcoin
///
/// Note: will panic if `initial_price=0`
pub fn calculate_origination_fee(
    loan_amount: Decimal,
    origination_fee_rate: Decimal,
    initial_price: Decimal,
) -> anyhow::Result<Amount> {
    let fee_usd = loan_amount
        .checked_mul(origination_fee_rate)
        .context("failed multiplying amount and fee")?;
    let fee_btc = fee_usd
        .checked_div(initial_price)
        .context("failed dividing by price")?;

    let fee_btc = fee_btc.round_dp(8);
    let fee_btc = fee_btc.to_f64().context("didn't fit into f64")?;

    Amount::from_btc(fee_btc).context("couldn't parse to Amount")
}

pub fn calculate_initial_collateral(
    loan_amount: Decimal,
    ltv: Decimal,
    initial_price: Decimal,
) -> anyhow::Result<Amount> {
    let collateral_value_usd = loan_amount
        .checked_div(ltv)
        .context("Failed to calculate collateral in USD")?;

    let collateral_btc = collateral_value_usd
        .checked_div(initial_price)
        .context("Failed to calculate collateral in BTC")?;

    let collateral_btc = collateral_btc.round_dp(8);
    let collateral_btc = collateral_btc.to_f64().expect("to fit");

    Ok(Amount::from_btc(collateral_btc).expect("to fit"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bitcoin::Amount;
    use rust_decimal_macros::dec;

    #[test]
    fn test_basic_fee_calculation() {
        let loan_amount = dec!(100_000.0);
        let fee_rate = dec!(0.02);
        let btc_price = dec!(50_000.0);

        let result = calculate_origination_fee(loan_amount, fee_rate, btc_price).unwrap();

        // Expected: $2000 worth of BTC at $50,000/BTC = 0.04 BTC
        assert_eq!(result, Amount::from_btc(0.04).unwrap());
    }

    #[test]
    fn test_small_amounts() {
        let loan_amount = dec!(1_000.0);
        let fee_rate = dec!(0.01);
        let btc_price = dec!(40_000.0);

        let result = calculate_origination_fee(loan_amount, fee_rate, btc_price).unwrap();

        // Expected: $10 worth of BTC at $40,000/BTC = 0.00025 BTC
        assert_eq!(result, Amount::from_btc(0.00025).unwrap());
    }

    #[test]
    fn test_precise_rounding() {
        let loan_amount = dec!(12_3456.78);
        let fee_rate = dec!(0.0234); // 2.34%
        let btc_price = dec!(45_678.90);

        let result = calculate_origination_fee(loan_amount, fee_rate, btc_price).unwrap();

        assert!(result.to_btc() < 0.100000001);
    }

    #[test]
    fn test_zero_fee_rate() {
        let loan_amount = dec!(50_000.0);
        let fee_rate = dec!(0);
        let btc_price = dec!(35_000.0);

        let result = calculate_origination_fee(loan_amount, fee_rate, btc_price).unwrap();

        assert_eq!(result, Amount::from_btc(0.0).unwrap());
    }

    #[test]
    fn test_zero_btc_price() {
        let loan_amount = dec!(50_000.0);
        let fee_rate = dec!(0.01);
        let btc_price = dec!(0);

        let result = calculate_origination_fee(loan_amount, fee_rate, btc_price);
        assert!(result.is_err());
    }

    #[test]
    fn test_large_numbers() {
        let loan_amount = dec!(1_000_000.0);
        let fee_rate = dec!(0.05); // 5%
        let btc_price = dec!(100_000.0);

        let result = calculate_origination_fee(loan_amount, fee_rate, btc_price).unwrap();

        // Expected: $50,000 worth of BTC at $100,000/BTC = 0.5 BTC
        assert_eq!(result, Amount::from_btc(0.5).unwrap());
    }

    #[test]
    fn test_zero_fee() {
        let loan_amount = dec!(100_000.0);
        let fee_rate = dec!(0);
        let btc_price = dec!(50_000.0);

        let result = calculate_origination_fee(loan_amount, fee_rate, btc_price).unwrap();

        // Expected: 0 BTC.
        assert_eq!(result, Amount::ZERO);
    }
}
