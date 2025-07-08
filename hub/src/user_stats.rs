use crate::db;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use utoipa::ToSchema;

#[derive(Debug)]
pub enum Error {
    /// Failed to interact with the database.
    Database(sqlx::Error),
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct LenderStats {
    pub id: String,
    name: String,
    successful_contracts: i64,
    failed_contracts: i64,
    timezone: Option<String>,
    #[serde(with = "rust_decimal::serde::float")]
    rating: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    joined_at: OffsetDateTime,
}

impl From<db::user_stats::LenderStats> for LenderStats {
    fn from(value: db::user_stats::LenderStats) -> Self {
        let rating = calculate_rating(value.successful_contracts, value.failed_contracts);
        LenderStats {
            id: value.id,
            name: value.name,
            timezone: value.timezone,
            successful_contracts: value.successful_contracts,
            failed_contracts: value.failed_contracts,
            rating,
            joined_at: value.created_at,
        }
    }
}

pub async fn get_lender_stats(db: &Pool<Postgres>, lender_id: &str) -> Result<LenderStats, Error> {
    let lender_stats = db::user_stats::get_lender_stats(db, lender_id)
        .await
        .map_err(Error::Database)?;

    Ok(LenderStats::from(lender_stats))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BorrowerStats {
    pub id: String,
    name: String,
    timezone: Option<String>,
    successful_contracts: i64,
    failed_contracts: i64,
    #[serde(with = "rust_decimal::serde::float")]
    rating: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    joined_at: OffsetDateTime,
}

impl From<db::user_stats::BorrowerStats> for BorrowerStats {
    fn from(value: db::user_stats::BorrowerStats) -> Self {
        let rating = calculate_rating(value.successful_contracts, value.failed_contracts);
        BorrowerStats {
            id: value.id,
            name: value.name,
            timezone: value.timezone,
            successful_contracts: value.successful_contracts,
            failed_contracts: value.failed_contracts,
            rating,
            joined_at: value.created_at,
        }
    }
}

pub async fn get_borrower_stats(
    db: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<BorrowerStats, Error> {
    let borrower_stats = db::user_stats::get_borrower_stats(db, borrower_id)
        .await
        .map_err(Error::Database)?;

    Ok(BorrowerStats::from(borrower_stats))
}

fn calculate_rating(positive_contracts: i64, negative_contracts: i64) -> Decimal {
    let positive = Decimal::from(positive_contracts);
    let negative = Decimal::from(negative_contracts);
    if positive + negative == Decimal::ZERO {
        return Decimal::ZERO;
    }

    positive / (negative + positive)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;
    use rust_decimal_macros::dec;

    #[test]
    fn test_calculate_lender_rating() {
        let test_cases = vec![
            (0, 0, Decimal::ZERO),  // Zero positive contracts
            (10, 0, Decimal::ONE),  // Only positive contracts
            (0, 10, Decimal::ZERO), // Only negative contracts
            (5, 5, dec!(0.5)),      // Equal positive and negative (0.5)
            (75, 25, dec!(0.75)),   // 75% positive rate
            (1, 3, dec!(0.25)),     // 25% positive rate
        ];

        for (positive, negative, expected) in test_cases {
            let result = calculate_rating(positive, negative);
            assert_eq!(
                result, expected,
                "Failed for positive: {positive}, negative: {negative}. Expected: {expected}, got: {result}",
            );
        }
    }
}
