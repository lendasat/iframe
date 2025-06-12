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

impl Default for LenderNotificationSettings {
    fn default() -> Self {
        let now = OffsetDateTime::now_utc();
        Self {
            id: 0,
            lender_id: String::new(),
            on_login_email: true,
            on_login_telegram: true,
            new_loan_applications_email: true,
            new_loan_applications_telegram: true,
            contract_status_changed_email: true,
            contract_status_changed_telegram: true,
            new_chat_message_email: true,
            new_chat_message_telegram: true,
            created_at: now,
            updated_at: now,
        }
    }
}

impl LenderNotificationSettings {
    pub fn new(lender_id: String) -> Self {
        let now = OffsetDateTime::now_utc();
        Self {
            id: 0,
            lender_id,
            on_login_email: true,
            on_login_telegram: true,
            new_loan_applications_email: true,
            new_loan_applications_telegram: true,
            contract_status_changed_email: true,
            contract_status_changed_telegram: true,
            new_chat_message_email: true,
            new_chat_message_telegram: true,
            created_at: now,
            updated_at: now,
        }
    }
}

impl Default for BorrowerNotificationSettings {
    fn default() -> Self {
        let now = OffsetDateTime::now_utc();
        Self {
            id: 0,
            borrower_id: String::new(),
            on_login_email: true,
            on_login_telegram: true,
            new_loan_offer_email: true,
            new_loan_offer_telegram: true,
            contract_status_changed_email: true,
            contract_status_changed_telegram: true,
            new_chat_message_email: true,
            new_chat_message_telegram: true,
            created_at: now,
            updated_at: now,
        }
    }
}

impl BorrowerNotificationSettings {
    pub fn new(borrower_id: String) -> Self {
        let now = OffsetDateTime::now_utc();
        Self {
            id: 0,
            borrower_id,
            on_login_email: true,
            on_login_telegram: true,
            new_loan_offer_email: true,
            new_loan_offer_telegram: true,
            contract_status_changed_email: true,
            contract_status_changed_telegram: true,
            new_chat_message_email: true,
            new_chat_message_telegram: true,
            created_at: now,
            updated_at: now,
        }
    }
}

pub async fn get_lender_notification_settings(
    pool: &PgPool,
    lender_id: &str,
) -> Result<LenderNotificationSettings> {
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
        Some(settings) => Ok(settings),
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
                Ok(LenderNotificationSettings::new(lender_id.to_string()))
            } else {
                anyhow::bail!("Lender not found")
            }
        }
    }
}

pub async fn get_borrower_notification_settings(
    pool: &PgPool,
    borrower_id: &str,
) -> Result<BorrowerNotificationSettings> {
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
        Some(settings) => Ok(settings),
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
                Ok(BorrowerNotificationSettings::new(borrower_id.to_string()))
            } else {
                anyhow::bail!("Borrower not found")
            }
        }
    }
}

pub async fn update_lender_notification_settings(
    pool: &PgPool,
    lender_id: &str,
    settings: &LenderNotificationSettings,
) -> Result<LenderNotificationSettings> {
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

    Ok(result)
}

pub async fn update_borrower_notification_settings(
    pool: &PgPool,
    borrower_id: &str,
    settings: &BorrowerNotificationSettings,
) -> Result<BorrowerNotificationSettings> {
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

    Ok(result)
}
