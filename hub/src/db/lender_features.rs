use crate::model::LenderFeatureFlag;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn load_lender_features(
    pool: &Pool<Postgres>,
    lender_id: String,
) -> Result<Vec<LenderFeatureFlag>, sqlx::Error> {
    sqlx::query_as!(
        LenderFeatureFlag,
        r#"
        SELECT 
            f.id,
            f.name,
            f.description,
            COALESCE(bff.is_enabled, f.enabled) as "is_enabled!: bool"
        FROM lender_features f
        LEFT JOIN lender_feature_flags bff 
            ON bff.feature_id = f.id 
            AND bff.lender_id = $1
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await
}

pub async fn enable_feature(
    pool: &Pool<Postgres>,
    lender_id: &str,
    feature_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
       INSERT INTO lender_feature_flags (lender_id, feature_id, is_enabled)
       VALUES (
           $1,
           $2,
           true
       )
       ON CONFLICT (lender_id, feature_id)
       DO UPDATE SET 
           is_enabled = true,
           updated_at = CURRENT_TIMESTAMP
       "#,
        lender_id,
        feature_id
    )
    .execute(pool)
    .await?;

    Ok(())
}
