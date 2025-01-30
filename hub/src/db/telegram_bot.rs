use rand::distributions::Alphanumeric;
use rand::thread_rng;
use rand::Rng;
use sqlx::PgPool;
use sqlx::Result;
use uuid::Uuid;

#[derive(Debug)]
pub struct TelegramBotToken {
    pub token: String,
    pub lender_id: String,
}

#[derive(Debug)]
pub struct TelegramBotChatId {
    pub lender_id: String,
    pub lender_name: String,
    pub chat_id: Option<String>,
}

pub async fn insert_telegram_bot_token_for_lender(
    pool: &PgPool,
    lender_id: &str,
) -> Result<TelegramBotToken> {
    let id = Uuid::new_v4();

    // Generate a random 14 character token
    let token: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(14)
        .map(char::from)
        .collect();

    let record = sqlx::query_as!(
        TelegramBotToken,
        r#"
        INSERT INTO telegram_bot_tokens (
            id, token, lender_id
        )
        VALUES (
            $1, $2, $3
        )
        RETURNING 
            token, lender_id
        "#,
        id,
        token,
        lender_id
    )
    .fetch_one(pool)
    .await?;

    Ok(record)
}

pub async fn get_or_create_token_by_lender_id(
    pool: &PgPool,
    lender_id: &str,
) -> Result<TelegramBotToken> {
    // First try to get existing token
    let existing_token = sqlx::query_as!(
        TelegramBotToken,
        r#"
        SELECT 
            token, lender_id 
        FROM 
            telegram_bot_tokens 
        WHERE 
            lender_id = $1
        "#,
        lender_id
    )
    .fetch_optional(pool)
    .await?;

    match existing_token {
        Some(token) => Ok(token),
        None => insert_telegram_bot_token_for_lender(pool, lender_id).await,
    }
}

pub async fn get_by_token(pool: &PgPool, token: &str) -> Result<Option<TelegramBotToken>> {
    let records = sqlx::query_as!(
        TelegramBotToken,
        r#"
        SELECT 
            token, lender_id
        FROM 
            telegram_bot_tokens
        WHERE 
            token = $1
        "#,
        token
    )
    .fetch_optional(pool)
    .await?;

    Ok(records)
}

pub async fn register_new_chat_id(
    pool: &PgPool,
    token: &str,
    chat_id: &str,
) -> Result<TelegramBotChatId> {
    let option = get_by_token(pool, token).await?;

    match option {
        None => Err(sqlx::Error::RowNotFound),
        Some(token) => {
            let chat_id =
                insert_telegram_bot_chat_id_for_lender(pool, token.lender_id.as_str(), chat_id)
                    .await?;
            Ok(chat_id)
        }
    }
}

async fn insert_telegram_bot_chat_id_for_lender(
    pool: &PgPool,
    lender_id: &str,
    chat_id: &str,
) -> Result<TelegramBotChatId> {
    let id = Uuid::new_v4();

    let record = sqlx::query_as!(
        TelegramBotChatId,
        r#"
        WITH inserted AS (
            INSERT INTO telegram_bot_chat_ids (
                id, lender_id, chat_id
            )
            VALUES (
                $1, $2, $3
            )
            ON CONFLICT (chat_id) DO UPDATE 
            SET 
                lender_id = EXCLUDED.lender_id
            RETURNING 
                lender_id, chat_id
        )
        SELECT 
            i.lender_id,
            i.chat_id,
            l.name as "lender_name!"
        FROM inserted i
        JOIN lenders l ON l.id = i.lender_id
        "#,
        id,
        lender_id,
        chat_id
    )
    .fetch_one(pool)
    .await?;

    Ok(record)
}
pub async fn get_chat_ids_by_lender(
    pool: &PgPool,
    lender_id: &str,
) -> Result<Vec<TelegramBotChatId>> {
    let records = sqlx::query_as!(
        TelegramBotChatId,
        r#"
        SELECT 
            i.lender_id, 
            i.chat_id,
            l.name as "lender_name!"
        FROM 
            telegram_bot_chat_ids i
            JOIN lenders l ON l.id = i.lender_id
        WHERE 
            i.lender_id = $1
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    Ok(records)
}

pub async fn delete_telegram_bot_chat_id_for_lender(pool: &PgPool, chat_id: &str) -> Result<()> {
    sqlx::query_as!(
        TelegramBotChatId,
        r#"
        DELETE FROM telegram_bot_chat_ids where chat_id = $1
        "#,
        chat_id
    )
    .execute(pool)
    .await?;

    Ok(())
}
