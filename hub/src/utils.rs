use crate::model::ONE_YEAR;
use crate::LEGACY_LTV_THRESHOLD_LIQUIDATION;
use crate::LTV_THRESHOLD_LIQUIDATION;
use anyhow::bail;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use std::ops::Div;
use std::ops::Mul;

pub fn calculate_ltv(
    price: Decimal,
    outstanding_balance: Decimal,
    collateral_sats: Decimal,
) -> anyhow::Result<Decimal> {
    if price.is_zero() || price.is_sign_negative() {
        bail!("Price cannot be zero or negative");
    }
    if outstanding_balance.is_zero() || outstanding_balance.is_sign_negative() {
        bail!("Outstanding balance cannot be zero or negative");
    }
    if collateral_sats.is_zero() || collateral_sats.is_sign_negative() {
        bail!("Collateral cannot be zero or negative");
    }

    Ok(outstanding_balance / ((collateral_sats / dec!(100_000_000)) * price))
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

pub fn calculate_interest(
    loan_amount: Decimal,
    loan_duration: i32,
    interest_rate: Decimal,
) -> Decimal {
    let one_year = Decimal::from(ONE_YEAR);
    let duration_decimal = Decimal::from(loan_duration);

    // Calculate interest using the formula:
    // interest = loan_amount * (interest_rate / 360) * duration_days
    let interest = loan_amount
        .mul(interest_rate)
        .div(one_year)
        .mul(duration_decimal);

    // Round to 2 decimal places
    interest.round_dp(2)
}

/// Validates if a given string is a valid email address.
///
/// This function checks for basic email format compliance:
/// - Contains a single @ symbol
/// - Has valid characters before the @ (alphanumeric, dots, underscores, hyphens, etc.)
/// - Has a valid domain after the @ (with a valid TLD)
/// - Follows general email formatting rules
///
/// # Examples
///
/// ```
/// use hub::utils::is_valid_email;
///
/// let valid = is_valid_email("user@example.com");
/// assert_eq!(valid, true);
///
/// let invalid = is_valid_email("invalid-email");
/// assert_eq!(invalid, false);
/// ```
pub fn is_valid_email(email: &str) -> bool {
    // Create a regex pattern for email validation
    // This pattern follows RFC 5322 standards with some practical limitations
    let email_regex = regex::Regex::new(r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$").expect("to be a valid regex");

    // Check if the email matches the pattern
    if !email_regex.is_match(email) {
        return false;
    }

    // Additional validation: check for domain with at least one dot
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return false; // Should have exactly one @ symbol
    }

    let domain = parts[1];
    if !domain.contains('.') {
        return false; // Domain must have at least one dot
    }

    // Check domain parts (ensure TLD is not numeric)
    let domain_parts: Vec<&str> = domain.split('.').collect();
    if domain_parts.is_empty() {
        return false;
    }

    let tld = domain_parts.last();
    match tld {
        None => {
            // No tld provided
            false
        }
        Some(tld) => {
            if tld.chars().all(|c| c.is_numeric()) {
                // TLD shouldn't be all numeric
                return false;
            }

            // Ensure the TLD is at least 2 characters
            if tld.len() < 2 {
                return false;
            }

            // Otherwise the email is valid
            true
        }
    }
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

    #[test]
    fn test_valid_emails() {
        assert!(is_valid_email("user@example.com"));
        assert!(is_valid_email("user.name@example.co.uk"));
        assert!(is_valid_email("user+tag@example.org"));
        assert!(is_valid_email("user-name@example.io"));
        assert!(is_valid_email("user_name@example.dev"));
    }

    #[test]
    fn test_invalid_emails() {
        assert!(!is_valid_email(""));
        assert!(!is_valid_email(" "));
        assert!(!is_valid_email("user"));
        assert!(!is_valid_email("user@"));
        assert!(!is_valid_email("@example.com"));
        assert!(!is_valid_email("user@example"));
        assert!(!is_valid_email("user@.com"));
        assert!(!is_valid_email("user@example"));
        assert!(!is_valid_email("user@example."));
        assert!(!is_valid_email("user@example.c"));
        assert!(!is_valid_email("user@example.123"));
        assert!(!is_valid_email("user@@example.com"));
    }

    #[test]
    fn test_calculate_interest() {
        // Test case: $10,000 loan at 5% for 30 days
        let loan_amount = dec!(10000);
        let loan_duration = 30;
        let interest_rate = dec!(0.05); // 0.05 or 5%

        let result = calculate_interest(loan_amount, loan_duration, interest_rate);

        // Expected: 10000 * (0.05 / 360) * 30 = 41.67
        let expected = dec!(41.67);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_zero_duration() {
        let loan_amount = dec!(10000);
        let loan_duration = 0;
        let interest_rate = dec!(0.05);

        let result = calculate_interest(loan_amount, loan_duration, interest_rate);
        assert_eq!(result, Decimal::ZERO);
    }

    #[test]
    fn test_zero_interest_rate() {
        let loan_amount = dec!(10000);
        let loan_duration = 30;
        let interest_rate = Decimal::ZERO;

        let result = calculate_interest(loan_amount, loan_duration, interest_rate);
        assert_eq!(result, Decimal::ZERO);
    }
}
