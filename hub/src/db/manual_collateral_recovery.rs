use crate::model;
use anyhow::Result;
use bitcoin::Amount;
use serde::Deserialize;
use sqlx::FromRow;
use sqlx::PgPool;
use time::OffsetDateTime;

#[derive(Debug, FromRow, Deserialize)]
struct ManualCollateralRecovery {
    id: i64,
    contract_id: String,
    lender_amount_sats: i64,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

pub async fn load_manual_collateral_recovery(
    pool: &PgPool,
    contract_id: &str,
) -> Result<Option<model::ManualCollateralRecovery>> {
    let entry = sqlx::query_as!(
        ManualCollateralRecovery,
        r#"
            SELECT
                id,
                contract_id,
                lender_amount_sats,
                created_at
            FROM manual_collateral_recovery
            WHERE contract_id = $1
        "#,
        contract_id
    )
    .fetch_optional(pool)
    .await?;

    let entry = entry.map(model::ManualCollateralRecovery::from);

    Ok(entry)
}

impl From<ManualCollateralRecovery> for model::ManualCollateralRecovery {
    fn from(value: ManualCollateralRecovery) -> Self {
        Self {
            id: value.id,
            contract_id: value.contract_id,
            lender_amount: Amount::from_sat(value.lender_amount_sats as u64),
            created_at: value.created_at,
        }
    }
}
