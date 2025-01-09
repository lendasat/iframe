use crate::db;
use rust_decimal::Decimal;
use sqlx::{Pool, Postgres};

#[derive(Debug)]
pub enum Error {
    InvalidDiscountRate { fee: Decimal },
    Database(sqlx::Error),
}

pub async fn calculate_discounted_origination_rate(
    db: &Pool<Postgres>,
    original_origination_rate: Decimal,
    user_id: &str,
) -> Result<Decimal, Error> {
    let maybe_discount_rate =
        db::borrowers_referral_code::get_first_time_discount_rate(db, user_id)
            .await
            .map_err(Error::Database)?;

    let origination_fee = match maybe_discount_rate {
        None => original_origination_rate,
        Some(discount_rate) => {
            calculate_origination_rate(original_origination_rate, discount_rate)?
        }
    };
    Ok(origination_fee)
}

fn calculate_origination_rate(
    origination_fee: Decimal,
    discount_rate: Decimal,
) -> Result<Decimal, Error> {
    if discount_rate > Decimal::ONE {
        return Err(Error::InvalidDiscountRate { fee: discount_rate });
    }
    let new_fee = origination_fee - (origination_fee * discount_rate);
    Ok(new_fee)
}

#[cfg(test)]
mod tests {
    use crate::discounted_origination_fee::calculate_origination_rate;
    use rust_decimal_macros::dec;

    #[test]
    fn test_calculate_discounted_origination_fee_rate_success() {
        let origination_fee = dec!(0.5);

        // Test 20% discount
        let result = calculate_origination_rate(origination_fee, dec!(0.2)).unwrap();
        assert_eq!(result, dec!(0.4)); // 50% - (50% / 20%) = 40%

        // Test 50% discount
        let result = calculate_origination_rate(origination_fee, dec!(0.5)).unwrap();
        assert_eq!(result, dec!(0.25)); // 50% - (50% / 50%) = 25%

        // Test no discount
        let result = calculate_origination_rate(origination_fee, dec!(0.0)).unwrap();
        assert_eq!(result, dec!(0.5));

        // Test 100% discount
        let result = calculate_origination_rate(origination_fee, dec!(1.0)).unwrap();
        assert_eq!(result, dec!(0.0));
    }

    #[test]
    fn test_calculate_discounted_origination_fee_rate_invalid_discount() {
        let origination_fee = dec!(0.5);

        // Test discount rate > 1
        let result = calculate_origination_rate(origination_fee, dec!(1.1));
        assert!(result.is_err());
    }
}
