use crate::model::BorrowerLoanFeature;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn load_borrower_features(
    pool: &Pool<Postgres>,
    borrower_id: String,
) -> Result<Vec<BorrowerLoanFeature>, sqlx::Error> {
    sqlx::query_as!(
        BorrowerLoanFeature,
        r#"
        SELECT 
            f.id,
            f.name,
            f.description,
            COALESCE(bff.is_enabled, f.enabled) as "is_enabled!: bool"
        FROM features f
        LEFT JOIN borrower_feature_flags bff 
            ON bff.feature_id = f.id 
            AND bff.borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_all(pool)
    .await
}

pub async fn enable_feature(
    pool: &Pool<Postgres>,
    user_id: &str,
    feature_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
       INSERT INTO borrower_feature_flags (borrower_id, feature_id, is_enabled)
       VALUES (
           $1,
           $2,
           true
       )
       ON CONFLICT (borrower_id, feature_id)
       DO UPDATE SET 
           is_enabled = true,
           updated_at = CURRENT_TIMESTAMP
       "#,
        user_id,
        feature_id
    )
    .execute(pool)
    .await?;

    Ok(())
}
