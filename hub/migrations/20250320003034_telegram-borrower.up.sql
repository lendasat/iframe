
ALTER TABLE telegram_bot_chat_ids
    DROP CONSTRAINT telegram_bot_chat_ids_chat_id_key;

ALTER TABLE telegram_bot_tokens
    DROP CONSTRAINT telegram_bot_tokens_token_key;

alter table telegram_bot_tokens
    rename to telegram_bot_tokens_lender;
alter table telegram_bot_chat_ids
    rename to telegram_bot_chat_ids_lender;


CREATE TABLE telegram_bot_tokens_borrower
(
    id          UUID                     NOT NULL PRIMARY KEY,
    token       char(14)                 NOT NULL,
    borrower_id char(36)                 NOT NULL REFERENCES borrowers (id),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telegram_bot_chat_ids_borrower
(
    id          UUID                     NOT NULL PRIMARY KEY,
    borrower_id char(36)                 NOT NULL REFERENCES borrowers (id),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chat_id     text
);
