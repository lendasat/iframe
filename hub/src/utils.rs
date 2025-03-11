use crate::LEGACY_LTV_THRESHOLD_LIQUIDATION;
use crate::LTV_THRESHOLD_LIQUIDATION;
use anyhow::bail;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

pub fn calculate_ltv(
    price: Decimal,
    loan_amount: Decimal,
    collateral_sats: Decimal,
) -> anyhow::Result<Decimal> {
    if price.is_zero() || price.is_sign_negative() {
        bail!("Price cannot be zero or negative");
    }
    if loan_amount.is_zero() || loan_amount.is_sign_negative() {
        bail!("Loan amount cannot be zero or negative");
    }
    if collateral_sats.is_zero() || collateral_sats.is_sign_negative() {
        bail!("Collateral cannot be zero or negative");
    }

    Ok(loan_amount / ((collateral_sats / dec!(100_000_000)) * price))
}

pub fn legacy_calculate_liquidation_price(
    loan_amount: Decimal,
    collateral_sats: Decimal,
) -> Option<Decimal> {
    loan_amount.checked_div(collateral_sats / dec!(100_000_000) * LEGACY_LTV_THRESHOLD_LIQUIDATION)
}

pub fn calculate_liquidation_price(
    loan_amount: Decimal,
    collateral_sats: Decimal,
) -> Option<Decimal> {
    loan_amount.checked_div(collateral_sats / dec!(100_000_000) * LTV_THRESHOLD_LIQUIDATION)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_calculate_ltv_basic() {
        let price = dec!(20000);
        let loan_amount = dec!(5000);
        let collateral_sats = dec!(250_000_000);

        let result = calculate_ltv(price, loan_amount, collateral_sats).expect("to work");
        // Expected LTV ratio = 5000 / (2.5 * 20000) = 0.1
        let expected = dec!(0.1);

        assert_eq!(result, expected);
    }

    #[test]
    fn test_calculate_ltv_basic2() {
        let price = dec!(100_000);
        let loan_amount = dec!(50_000);
        let collateral_sats = dec!(100_000_000);

        let result = calculate_ltv(price, loan_amount, collateral_sats).expect("to work");
        // Expected LTV ratio = 50_000 / (1 * 100_000) = 0.5
        let expected = dec!(0.5);

        assert_eq!(result, expected);
    }

    #[test]
    fn test_calculate_ltv_fifty_percent() {
        let price = dec!(10000);
        let loan_amount = dec!(5000);
        let collateral_sats = dec!(100_000_000);

        let result = calculate_ltv(price, loan_amount, collateral_sats).expect("to work");
        // Expected LTV ratio = 5000 / (1 * 10000) = 0.5
        let expected = dec!(0.5);

        assert!((result - expected).abs() < dec!(0.0001)); // Allow small precision difference
    }

    #[test]
    fn test_calculate_ltv_high_ltv() {
        let price = dec!(30000);
        let loan_amount = dec!(25000);
        let collateral_sats = dec!(100_000_000);

        let result = calculate_ltv(price, loan_amount, collateral_sats).expect("to work");
        let expected = dec!(0.8333333333);

        assert!((result - expected).abs() < dec!(0.0001));
    }

    #[test]
    fn test_calculate_ltv_zero_collateral() {
        let price = dec!(40000);
        let loan_amount = dec!(10000);
        let collateral_sats = dec!(0);

        let error = calculate_ltv(price, loan_amount, collateral_sats).is_err();

        assert!(error);
    }

    #[test]
    fn test_calculate_ltv_zero_loan() {
        let price = dec!(50000);
        let loan_amount = dec!(0);
        let collateral_sats = dec!(100_000_000);

        let error = calculate_ltv(price, loan_amount, collateral_sats).is_err();

        assert!(error);
    }

    #[test]
    fn test_legacy_liquidation_price_ltv_roundtrip() {
        let loan_amount = dec!(50_000);
        let collateral_sats = dec!(100_000_000); // 1 BTC
        let liquidation_price =
            legacy_calculate_liquidation_price(loan_amount, collateral_sats).unwrap();
        let expected = dec!(52631.578947);

        assert!(
            (liquidation_price - expected).abs() < dec!(0.0001),
            "({liquidation_price} - {expected}) < 0.0001"
        );

        let result =
            calculate_ltv(liquidation_price, loan_amount, collateral_sats).expect("to work");
        let expected = LEGACY_LTV_THRESHOLD_LIQUIDATION;

        assert!(
            (result - expected).abs() < dec!(0.0001),
            "({} - {}).abs() < 0.0001",
            result,
            expected
        );
    }

    #[test]
    fn test_liquidation_price_ltv_roundtrip() {
        let loan_amount = dec!(50_000);
        let collateral_sats = dec!(100_000_000); // 1 BTC
        let liquidation_price = calculate_liquidation_price(loan_amount, collateral_sats).unwrap();
        let expected = dec!(55555.55555);

        assert!(
            (liquidation_price - expected).abs() < dec!(0.0001),
            "({liquidation_price} - {expected}) < 0.0001"
        );

        let result =
            calculate_ltv(liquidation_price, loan_amount, collateral_sats).expect("to work");
        let expected = LTV_THRESHOLD_LIQUIDATION;

        assert!(
            (result - expected).abs() < dec!(0.0001),
            "({} - {}).abs() < 0.0001",
            result,
            expected
        );
    }
}
