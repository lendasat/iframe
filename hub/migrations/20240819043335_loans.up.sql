-- Add up migration script here

-- note: these types need to be pascal case because of how we serialize enums
CREATE TYPE loan_asset_type AS ENUM ('Usdc', 'Usdt');

CREATE TYPE loan_asset_chain AS ENUM ('Ethereum', 'Starknet');

CREATE TYPE loan_offer_status AS ENUM ('Available', 'Unavailable', 'Deleted');


CREATE TABLE
    IF NOT EXISTS "loans"
(
    id                  CHAR(36) PRIMARY KEY     NOT NULL,
    lender_id           CHAR(36)                 NOT NULL,
    name                VARCHAR(100)             NOT NULL,
    min_ltv             DECIMAL                  NOT NULL,
    interest_rate       DECIMAL                  NOT NULL,
    loan_amount_min     DECIMAL                  NOT NULL,
    loan_amount_max     DECIMAL                  NOT NULL,
    duration_months_min INT                      NOT NULL,
    duration_months_max INT                      NOT NULL,
    loan_asset_type     loan_asset_type          NOT NULL,
    loan_asset_chain    loan_asset_chain         NOT NULL,
    status              loan_offer_status        NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES users (id)
);
