use anyhow::Result;
use sqlx::PgPool;
use time::OffsetDateTime;

#[derive(Debug, Clone)]
pub struct LenderNotificationSettings {
    pub id: i32,
    pub lender_id: String,
    pub on_login_email: bool,
    pub on_login_telegram: bool,
    pub new_loan_applications_email: bool,
    pub new_loan_applications_telegram: bool,
    pub contract_status_changed_email: bool,
    pub contract_status_changed_telegram: bool,
    pub new_chat_message_email: bool,
    pub new_chat_message_telegram: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

impl From<LenderNotificationSettings> for crate::model::notifications::LenderNotificationSettings {
    fn from(value: LenderNotificationSettings) -> Self {
        crate::model::notifications::LenderNotificationSettings {
            lender_id: value.lender_id.clone(),
            on_login_email: value.on_login_email,
            on_login_telegram: value.on_login_telegram,
            new_loan_applications_email: value.new_loan_applications_email,
            new_loan_applications_telegram: value.new_loan_applications_telegram,
            contract_status_changed_email: value.contract_status_changed_email,
            contract_status_changed_telegram: value.contract_status_changed_telegram,
            new_chat_message_email: value.new_chat_message_email,
            new_chat_message_telegram: value.new_chat_message_telegram,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BorrowerNotificationSettings {
    pub id: i32,
    pub borrower_id: String,
    pub on_login_email: bool,
    pub on_login_telegram: bool,
    pub new_loan_offer_email: bool,
    pub new_loan_offer_telegram: bool,
    pub contract_status_changed_email: bool,
    pub contract_status_changed_telegram: bool,
    pub new_chat_message_email: bool,
    pub new_chat_message_telegram: bool,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

impl From<BorrowerNotificationSettings>
    for crate::model::notifications::BorrowerNotificationSettings
{
    fn from(value: BorrowerNotificationSettings) -> Self {
        crate::model::notifications::BorrowerNotificationSettings {
            borrower_id: value.borrower_id.clone(),
            on_login_email: value.on_login_email,
            on_login_telegram: value.on_login_telegram,
            new_loan_offer_email: value.new_loan_offer_email,
            new_loan_offer_telegram: value.new_loan_offer_telegram,
            contract_status_changed_email: value.contract_status_changed_email,
            contract_status_changed_telegram: value.contract_status_changed_telegram,
            new_chat_message_email: value.new_chat_message_email,
            new_chat_message_telegram: value.new_chat_message_telegram,
        }
    }
}

pub async fn get_lender_notification_settings(
    pool: &PgPool,
    lender_id: &str,
) -> Result<crate::model::notifications::LenderNotificationSettings> {
    let result = sqlx::query_as!(
        LenderNotificationSettings,
        r#"
        SELECT 
            id,
            lender_id,
            on_login_email,
            on_login_telegram,
            new_loan_applications_email,
            new_loan_applications_telegram,
            contract_status_changed_email,
            contract_status_changed_telegram,
            new_chat_message_email,
            new_chat_message_telegram,
            created_at,
            updated_at
        FROM lender_notification_settings 
        WHERE lender_id = $1
        "#,
        lender_id
    )
    .fetch_optional(pool)
    .await?;

    match result {
        Some(settings) => Ok(settings.into()),
        None => {
            // Check if lender exists
            let lender_exists = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM lenders WHERE id = $1)",
                lender_id
            )
            .fetch_one(pool)
            .await?
            .unwrap_or_default();

            if lender_exists {
                Ok(
                    crate::model::notifications::LenderNotificationSettings::new(
                        lender_id.to_string(),
                    ),
                )
            } else {
                anyhow::bail!("Lender not found")
            }
        }
    }
}

pub async fn get_borrower_notification_settings(
    pool: &PgPool,
    borrower_id: &str,
) -> Result<crate::model::notifications::BorrowerNotificationSettings> {
    let result = sqlx::query_as!(
        BorrowerNotificationSettings,
        r#"
        SELECT 
            id,
            borrower_id,
            on_login_email,
            on_login_telegram,
            new_loan_offer_email,
            new_loan_offer_telegram,
            contract_status_changed_email,
            contract_status_changed_telegram,
            new_chat_message_email,
            new_chat_message_telegram,
            created_at,
            updated_at
        FROM borrower_notification_settings 
        WHERE borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_optional(pool)
    .await?;

    match result {
        Some(settings) => Ok(settings.into()),
        None => {
            // Check if borrower exists
            let borrower_exists = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM borrowers WHERE id = $1)",
                borrower_id
            )
            .fetch_one(pool)
            .await?
            .unwrap_or_default();

            if borrower_exists {
                Ok(
                    crate::model::notifications::BorrowerNotificationSettings::new(
                        borrower_id.to_string(),
                    ),
                )
            } else {
                anyhow::bail!("Borrower not found")
            }
        }
    }
}

pub async fn update_lender_notification_settings(
    pool: &PgPool,
    lender_id: &str,
    settings: &crate::model::notifications::LenderNotificationSettings,
) -> Result<crate::model::notifications::LenderNotificationSettings> {
    let result = sqlx::query_as!(
        LenderNotificationSettings,
        r#"
        INSERT INTO lender_notification_settings (
            lender_id,
            on_login_email,
            on_login_telegram,
            new_loan_applications_email,
            new_loan_applications_telegram,
            contract_status_changed_email,
            contract_status_changed_telegram,
            new_chat_message_email,
            new_chat_message_telegram,
            updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP
        )
        ON CONFLICT (lender_id) DO UPDATE SET
            on_login_email = EXCLUDED.on_login_email,
            on_login_telegram = EXCLUDED.on_login_telegram,
            new_loan_applications_email = EXCLUDED.new_loan_applications_email,
            new_loan_applications_telegram = EXCLUDED.new_loan_applications_telegram,
            contract_status_changed_email = EXCLUDED.contract_status_changed_email,
            contract_status_changed_telegram = EXCLUDED.contract_status_changed_telegram,
            new_chat_message_email = EXCLUDED.new_chat_message_email,
            new_chat_message_telegram = EXCLUDED.new_chat_message_telegram,
            updated_at = CURRENT_TIMESTAMP
        RETURNING 
            id,
            lender_id,
            on_login_email,
            on_login_telegram,
            new_loan_applications_email,
            new_loan_applications_telegram,
            contract_status_changed_email,
            contract_status_changed_telegram,
            new_chat_message_email,
            new_chat_message_telegram,
            created_at,
            updated_at
        "#,
        lender_id,
        settings.on_login_email,
        settings.on_login_telegram,
        settings.new_loan_applications_email,
        settings.new_loan_applications_telegram,
        settings.contract_status_changed_email,
        settings.contract_status_changed_telegram,
        settings.new_chat_message_email,
        settings.new_chat_message_telegram
    )
    .fetch_one(pool)
    .await?;

    Ok(result.into())
}

pub async fn update_borrower_notification_settings(
    pool: &PgPool,
    borrower_id: &str,
    settings: &crate::model::notifications::BorrowerNotificationSettings,
) -> Result<crate::model::notifications::BorrowerNotificationSettings> {
    let result = sqlx::query_as!(
        BorrowerNotificationSettings,
        r#"
        INSERT INTO borrower_notification_settings (
            borrower_id,
            on_login_email,
            on_login_telegram,
            new_loan_offer_email,
            new_loan_offer_telegram,
            contract_status_changed_email,
            contract_status_changed_telegram,
            new_chat_message_email,
            new_chat_message_telegram,
            updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP
        )
        ON CONFLICT (borrower_id) DO UPDATE SET
            on_login_email = EXCLUDED.on_login_email,
            on_login_telegram = EXCLUDED.on_login_telegram,
            new_loan_offer_email = EXCLUDED.new_loan_offer_email,
            new_loan_offer_telegram = EXCLUDED.new_loan_offer_telegram,
            contract_status_changed_email = EXCLUDED.contract_status_changed_email,
            contract_status_changed_telegram = EXCLUDED.contract_status_changed_telegram,
            new_chat_message_email = EXCLUDED.new_chat_message_email,
            new_chat_message_telegram = EXCLUDED.new_chat_message_telegram,
            updated_at = CURRENT_TIMESTAMP
        RETURNING 
            id,
            borrower_id,
            on_login_email,
            on_login_telegram,
            new_loan_offer_email,
            new_loan_offer_telegram,
            contract_status_changed_email,
            contract_status_changed_telegram,
            new_chat_message_email,
            new_chat_message_telegram,
            created_at,
            updated_at
        "#,
        borrower_id,
        settings.on_login_email,
        settings.on_login_telegram,
        settings.new_loan_offer_email,
        settings.new_loan_offer_telegram,
        settings.contract_status_changed_email,
        settings.contract_status_changed_telegram,
        settings.new_chat_message_email,
        settings.new_chat_message_telegram
    )
    .fetch_one(pool)
    .await?;

    Ok(result.into())
}

#[derive(Debug, Clone)]
pub struct BorrowerContact {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub new_loan_offer_email: Option<bool>,
    pub new_loan_offer_telegram: Option<bool>,
}

pub async fn get_borrowers_for_loan_offer_notifications(
    pool: &PgPool,
) -> Result<Vec<BorrowerContact>> {
    let result = sqlx::query_as!(
        BorrowerContact,
        r#"
        SELECT 
            b.id as "id!",
            b.name as "name!",
            b.email as email,
            COALESCE(bns.new_loan_offer_email, true) as new_loan_offer_email,
            COALESCE(bns.new_loan_offer_telegram, true) as new_loan_offer_telegram
        FROM borrowers b
        LEFT JOIN borrower_notification_settings bns ON b.id = bns.borrower_id
        LEFT JOIN borrowers_password_auth bpa ON b.id = bpa.borrower_id
        where bpa.verified = true
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(result)
}

#[derive(Debug, Clone)]
pub struct LenderContact {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub new_loan_applications_email: Option<bool>,
    pub new_loan_applications_telegram: Option<bool>,
}

pub async fn get_lenders_for_loan_loan_application(pool: &PgPool) -> Result<Vec<LenderContact>> {
    let result = sqlx::query_as!(
        LenderContact,
        r#"
        SELECT 
            l.id as "id!",
            l.name as "name!",
            l.email as email,
            COALESCE(lns.new_loan_applications_email, true) as new_loan_applications_email,
            COALESCE(lns.new_loan_applications_telegram, true) as new_loan_applications_telegram
        FROM lenders l
        LEFT JOIN lender_notification_settings lns ON l.id = lns.lender_id
        where l.verified = true
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(result)
}
