CREATE TABLE api_keys_borrower
(
    id                    SERIAL PRIMARY KEY,
    description           TEXT                     NOT NULL,
    borrower_id           CHAR(36)                 NOT NULL,
    api_key_hash          CHAR(64)                 NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);

CREATE TABLE api_keys_lender
(
    id                    SERIAL PRIMARY KEY,
    description           TEXT                     NOT NULL,
    lender_id             CHAR(36)                 NOT NULL,
    api_key_hash          CHAR(64)                 NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES lenders (id)
);
