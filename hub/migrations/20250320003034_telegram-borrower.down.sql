alter table telegram_bot_tokens_lender
    rename to telegram_bot_tokens;
alter table telegram_bot_chat_ids_lender
    rename to telegram_bot_chat_ids;

ALTER TABLE telegram_bot_chat_ids
    ADD CONSTRAINT telegram_bot_chat_ids_chat_id_key UNIQUE (chat_id);

ALTER TABLE telegram_bot_tokens
    ADD CONSTRAINT telegram_bot_tokens_token_key UNIQUE (token);

drop table if exists telegram_bot_tokens_borrower;
drop table if exists telegram_bot_chat_ids_borrower;
