use crate::db;
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
    /// Number of total closed or currently open contracts
    successful_contracts: i64,
    timezone: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    joined_at: OffsetDateTime,
    /// Indicates if the lender has been vetted by the platform
    vetted: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct BorrowerStats {
    pub id: String,
    name: String,
    /// Number of total closed or currently open contracts
    successful_contracts: i64,
    timezone: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    joined_at: OffsetDateTime,
}

impl From<db::user_stats::LenderStats> for LenderStats {
    fn from(value: db::user_stats::LenderStats) -> Self {
        LenderStats {
            id: value.id,
            name: value.name,
            timezone: value.timezone,
            successful_contracts: value.successful_contracts,
            joined_at: value.created_at,
            vetted: value.vetted,
        }
    }
}

impl From<db::user_stats::BorrowerStats> for BorrowerStats {
    fn from(value: db::user_stats::BorrowerStats) -> Self {
        BorrowerStats {
            id: value.id,
            name: value.name,
            timezone: value.timezone,
            successful_contracts: value.successful_contracts,
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

pub async fn get_borrower_stats(
    db: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<BorrowerStats, Error> {
    let borrower_stats = db::user_stats::get_borrower_stats(db, borrower_id)
        .await
        .map_err(Error::Database)?;

    Ok(BorrowerStats::from(borrower_stats))
}
