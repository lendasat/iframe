ALTER TYPE loan_type ADD VALUE IF NOT EXISTS 'Bringin';

CREATE TABLE IF NOT EXISTS bringin_api_keys
(
    id                    SERIAL PRIMARY KEY,
    borrower_id           CHAR(36)                 NOT NULL UNIQUE,
    api_key               TEXT                     NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);
