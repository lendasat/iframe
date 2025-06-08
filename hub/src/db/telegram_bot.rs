use sqlx::PgPool;

#[derive(Debug)]
pub enum UserType {
    Borrower,
    Lender,
}

#[derive(Debug)]
pub struct TelegramBotToken {
    pub token: String,
    pub user_id: String,
    pub user_type: UserType,
}

#[derive(Debug)]
pub struct TelegramBotChatId {
    pub user_id: String,
    pub user_name: String,
    pub chat_id: Option<String>,
}

pub async fn get_by_token(pool: &PgPool, token: &str) -> sqlx::Result<Option<TelegramBotToken>> {
    // Try to find in borrower table first
    let borrower_record = sqlx::query!(
        r#"
        SELECT 
            token, borrower_id as user_id
        FROM 
            telegram_bot_tokens_borrower
        WHERE 
            token = $1
        "#,
        token
    )
    .fetch_optional(pool)
    .await?;

    if let Some(record) = borrower_record {
        return Ok(Some(TelegramBotToken {
            token: record.token,
            user_id: record.user_id,
            user_type: UserType::Borrower,
        }));
    }

    // If not found in borrower table, try lender table
    let lender_record = sqlx::query!(
        r#"
        SELECT 
            token, lender_id as user_id
        FROM 
            telegram_bot_tokens_lender
        WHERE 
            token = $1
        "#,
        token
    )
    .fetch_optional(pool)
    .await?;

    if let Some(record) = lender_record {
        return Ok(Some(TelegramBotToken {
            token: record.token,
            user_id: record.user_id,
            user_type: UserType::Lender,
        }));
    }

    Ok(None)
}

pub async fn register_new_chat_id(
    pool: &PgPool,
    token: &str,
    chat_id: &str,
) -> sqlx::Result<TelegramBotChatId> {
    let option = get_by_token(pool, token).await?;

    match option {
        None => Err(sqlx::Error::RowNotFound),
        Some(TelegramBotToken {
            user_id,
            user_type: UserType::Lender,
            ..
        }) => {
            let chat_id =
                lender::insert_telegram_bot_chat_id_for_lender(pool, user_id.as_str(), chat_id)
                    .await?;
            Ok(chat_id)
        }
        Some(TelegramBotToken {
            user_id,
            user_type: UserType::Borrower,
            ..
        }) => {
            let chat_id =
                borrower::insert_telegram_bot_chat_id_for_borrower(pool, user_id.as_str(), chat_id)
                    .await?;
            Ok(chat_id)
        }
    }
}

pub async fn delete_telegram_bot_chat_id(pool: &PgPool, chat_id: &str) -> sqlx::Result<()> {
    // Delete from lender table
    sqlx::query!(
        r#"
        DELETE FROM telegram_bot_chat_ids_lender WHERE chat_id = $1
        "#,
        chat_id
    )
    .execute(pool)
    .await?;

    // Delete from borrower table
    sqlx::query!(
        r#"
        DELETE FROM telegram_bot_chat_ids_borrower WHERE chat_id = $1
        "#,
        chat_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub(crate) mod lender {
    use crate::db::telegram_bot::TelegramBotChatId;
    use crate::db::telegram_bot::TelegramBotToken;
    use crate::db::telegram_bot::UserType;
    use rand::distributions::Alphanumeric;
    use rand::thread_rng;
    use rand::Rng;
    use sqlx::PgPool;
    use uuid::Uuid;

    async fn insert_telegram_bot_token_for_lender(
        pool: &PgPool,
        lender_id: &str,
    ) -> sqlx::Result<TelegramBotToken> {
        let id = Uuid::new_v4();

        // Generate a random 14 character token
        let token: String = thread_rng()
            .sample_iter(&Alphanumeric)
            .take(14)
            .map(char::from)
            .collect();

        let record = sqlx::query!(
            r#"
        INSERT INTO telegram_bot_tokens_lender (
            id, token, lender_id
        )
        VALUES (
            $1, $2, $3
        )
        RETURNING 
            token, lender_id as user_id
        "#,
            id,
            token,
            lender_id
        )
        .fetch_one(pool)
        .await?;

        Ok(TelegramBotToken {
            token: record.token,
            user_id: record.user_id,
            user_type: UserType::Lender,
        })
    }

    pub async fn get_or_create_token_by_lender_id(
        pool: &PgPool,
        lender_id: &str,
    ) -> sqlx::Result<TelegramBotToken> {
        // First try to get existing token
        let existing_token = sqlx::query!(
            r#"
        SELECT 
            token, lender_id as user_id
        FROM 
            telegram_bot_tokens_lender 
        WHERE 
            lender_id = $1
        "#,
            lender_id
        )
        .fetch_optional(pool)
        .await?;

        match existing_token {
            Some(record) => Ok(TelegramBotToken {
                token: record.token,
                user_id: record.user_id,
                user_type: UserType::Lender,
            }),
            None => insert_telegram_bot_token_for_lender(pool, lender_id).await,
        }
    }

    pub(crate) async fn insert_telegram_bot_chat_id_for_lender(
        pool: &PgPool,
        lender_id: &str,
        chat_id: &str,
    ) -> sqlx::Result<TelegramBotChatId> {
        let id = Uuid::new_v4();

        let record = sqlx::query_as!(
            TelegramBotChatId,
            r#"
            WITH upsert AS (
                INSERT INTO telegram_bot_chat_ids_lender (
                    id, lender_id, chat_id
                )
                VALUES (
                    $1, $2, $3
                )
                RETURNING id, lender_id, chat_id
            )
            SELECT 
                u.lender_id as user_id,
                u.chat_id,
                l.name as "user_name!"
            FROM upsert u
            JOIN lenders l ON l.id = u.lender_id
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
    ) -> sqlx::Result<Vec<TelegramBotChatId>> {
        let records = sqlx::query_as!(
            TelegramBotChatId,
            r#"
        SELECT 
            i.lender_id as user_id, 
            i.chat_id,
            l.name as "user_name!"
        FROM 
            telegram_bot_chat_ids_lender i
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
}

pub mod borrower {
    use crate::db::telegram_bot::TelegramBotChatId;
    use crate::db::telegram_bot::TelegramBotToken;
    use crate::db::telegram_bot::UserType;
    use rand::distributions::Alphanumeric;
    use rand::thread_rng;
    use rand::Rng;
    use sqlx::PgPool;
    use uuid::Uuid;

    pub async fn insert_telegram_bot_token_for_borrower(
        pool: &PgPool,
        borrower_id: &str,
    ) -> sqlx::Result<TelegramBotToken> {
        let id = Uuid::new_v4();

        // Generate a random 14 character token
        let token: String = thread_rng()
            .sample_iter(&Alphanumeric)
            .take(14)
            .map(char::from)
            .collect();

        let record = sqlx::query!(
            r#"
        INSERT INTO telegram_bot_tokens_borrower (
            id, token, borrower_id
        )
        VALUES (
            $1, $2, $3
        )
        RETURNING 
            token, borrower_id as user_id
        "#,
            id,
            token,
            borrower_id
        )
        .fetch_one(pool)
        .await?;

        Ok(TelegramBotToken {
            token: record.token,
            user_id: record.user_id,
            user_type: UserType::Borrower,
        })
    }

    pub async fn get_or_create_token_by_borrower_id(
        pool: &PgPool,
        borrower_id: &str,
    ) -> sqlx::Result<TelegramBotToken> {
        // First try to get existing token
        let existing_token = sqlx::query!(
            r#"
        SELECT 
            token, borrower_id as user_id
        FROM 
            telegram_bot_tokens_borrower 
        WHERE 
            borrower_id = $1
        "#,
            borrower_id
        )
        .fetch_optional(pool)
        .await?;

        match existing_token {
            Some(record) => Ok(TelegramBotToken {
                token: record.token,
                user_id: record.user_id,
                user_type: UserType::Borrower,
            }),
            None => insert_telegram_bot_token_for_borrower(pool, borrower_id).await,
        }
    }

    pub(crate) async fn insert_telegram_bot_chat_id_for_borrower(
        pool: &PgPool,
        borrower_id: &str,
        chat_id: &str,
    ) -> sqlx::Result<TelegramBotChatId> {
        let id = Uuid::new_v4();

        let record = sqlx::query_as!(
            TelegramBotChatId,
            r#"
            WITH upsert AS (
                INSERT INTO telegram_bot_chat_ids_borrower (
                    id, borrower_id, chat_id
                )
                VALUES (
                    $1, $2, $3
                )
                RETURNING id, borrower_id, chat_id
            )
            SELECT 
                u.borrower_id as user_id,
                u.chat_id,
                l.name as "user_name!"
            FROM upsert u
            JOIN borrowers l ON l.id = u.borrower_id
            "#,
            id,
            borrower_id,
            chat_id
        )
        .fetch_one(pool)
        .await?;
        Ok(record)
    }
    pub async fn get_chat_ids_by_borrower(
        pool: &PgPool,
        borrower_id: &str,
    ) -> sqlx::Result<Vec<TelegramBotChatId>> {
        let records = sqlx::query_as!(
            TelegramBotChatId,
            r#"
        SELECT 
            i.borrower_id as user_id, 
            i.chat_id,
            l.name as "user_name!"
        FROM 
            telegram_bot_chat_ids_borrower i
            JOIN borrowers l ON l.id = i.borrower_id
        WHERE 
            i.borrower_id = $1
        "#,
            borrower_id
        )
        .fetch_all(pool)
        .await?;

        Ok(records)
    }
}
