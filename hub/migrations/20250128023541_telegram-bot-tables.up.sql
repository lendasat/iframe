    CREATE TABLE telegram_bot_tokens
(
    id         UUID                     NOT NULL PRIMARY KEY,
    token      char(14)                 NOT NULL,
    lender_id  char(36)                 NOT NULL REFERENCES lenders (id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (token)
);

CREATE TABLE telegram_bot_chat_ids
(
    id         UUID                     NOT NULL PRIMARY KEY,
    lender_id  char(36)                 NOT NULL REFERENCES lenders (id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chat_id    text unique
);
