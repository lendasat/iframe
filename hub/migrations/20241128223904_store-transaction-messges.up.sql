-- Create the table for TransactionStatus enum
CREATE TYPE moon_transaction_status AS ENUM (
    'Authorization',
    'Reversal',
    'Clearing',
    'Refund',
    'Pending',
    'Settled',
    'Unknown'
    );


-- Create the table for TransactionData
CREATE TABLE moon_transaction_data
(
    transaction_id                      UUID PRIMARY KEY,
    -- we don't use a reference here to be able to detect invalid messages
    -- from moon where they mess up the card id
    card_public_id                      char(36)                 NOT NULL,
    transaction_status                  moon_transaction_status  NOT NULL,
    datetime                            TEXT                     NOT NULL,
    merchant                            TEXT                     NOT NULL,
    amount                              NUMERIC                  NOT NULL,
    ledger_currency                     TEXT                     NOT NULL,
    amount_fees_in_ledger_currency      NUMERIC                  NOT NULL,
    amount_in_transaction_currency      NUMERIC                  NOT NULL,
    transaction_currency                TEXT                     NOT NULL,
    amount_fees_in_transaction_currency NUMERIC                  NOT NULL,
    created_at                          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Create the table for Fee
CREATE TABLE moon_transaction_fees
(
    id              SERIAL PRIMARY KEY,
    fee_type        TEXT                     NOT NULL,
    amount          NUMERIC                  NOT NULL,
    fee_description TEXT                     NOT NULL,
    transaction_id  UUID                     NOT NULL REFERENCES moon_transaction_data (transaction_id) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moon_transaction_decline_data
(
    id                            SERIAL PRIMARY KEY,
    message_id                    INT                      NOT NULL,
    -- the date in the message called `created_at`
    datetime                      TEXT                     NOT NULL,
    merchant                      TEXT                     NOT NULL,
    customer_friendly_description TEXT                     NOT NULL,
    amount                        NUMERIC                  NOT NULL,
    card_public_id                char(36)                 NOT NULL REFERENCES moon_cards (id) ON DELETE CASCADE,
    -- our own tracking date time
    created_at                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

