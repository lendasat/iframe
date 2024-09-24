-- Add up migration script here

CREATE TABLE INVITE_CODES
(
    id     SERIAL PRIMARY KEY,
    code   VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL
);


INSERT INTO INVITE_CODES (code, active) VALUES ('IMONFIRE2024', true);

CREATE TABLE
    IF NOT EXISTS "borrowers"
(
    id                   CHAR(36) PRIMARY KEY     NOT NULL,
    name                 VARCHAR(100)             NOT NULL,
    email                VARCHAR(255)             NOT NULL UNIQUE,
    password             VARCHAR(100)             NOT NULL,
    verified             BOOLEAN                  NOT NULL DEFAULT FALSE,
    verification_code    VARCHAR(255),
    password_reset_token VARCHAR(50),
    password_reset_at    TIMESTAMP WITH TIME ZONE          DEFAULT CURRENT_TIMESTAMP,
    invite_code          INT REFERENCES INVITE_CODES(id),
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE
    IF NOT EXISTS "lenders"
(
    id                   CHAR(36) PRIMARY KEY     NOT NULL,
    name                 VARCHAR(100)             NOT NULL,
    email                VARCHAR(255)             NOT NULL UNIQUE,
    password             VARCHAR(100)             NOT NULL,
    verified             BOOLEAN                  NOT NULL DEFAULT FALSE,
    verification_code    VARCHAR(255),
    password_reset_token VARCHAR(50),
    password_reset_at    TIMESTAMP WITH TIME ZONE          DEFAULT CURRENT_TIMESTAMP,
    invite_code          INT REFERENCES INVITE_CODES (id),
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- note: these types need to be pascal case because of how we serialize enums
CREATE TYPE loan_asset_type AS ENUM ('Usdc', 'Usdt');
CREATE TYPE loan_asset_chain AS ENUM ('Ethereum', 'Starknet');
CREATE TYPE loan_offer_status AS ENUM ('Available', 'Unavailable', 'Deleted');


CREATE TABLE
    IF NOT EXISTS "loan_offers"
(
    id                     CHAR(36) PRIMARY KEY     NOT NULL,
    lender_id              CHAR(36)                 NOT NULL,
    name                   VARCHAR(100)             NOT NULL,
    min_ltv                DECIMAL                  NOT NULL,
    interest_rate          DECIMAL                  NOT NULL,
    loan_amount_min        DECIMAL                  NOT NULL,
    loan_amount_max        DECIMAL                  NOT NULL,
    duration_months_min    INT                      NOT NULL,
    duration_months_max    INT                      NOT NULL,
    loan_asset_type        loan_asset_type          NOT NULL,
    loan_asset_chain       loan_asset_chain         NOT NULL,
    status                 loan_offer_status        NOT NULL,
    loan_repayment_address VARCHAR                  NOT NULL,
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES lenders (id)
);

CREATE TYPE contract_status AS ENUM (
    'Requested',
    'Approved',
    'CollateralSeen',
    'CollateralConfirmed',
    'PrincipalGiven',
    'Repaid',
    'Closing',
    'Closed',
    'Rejected',
    'DisputeBorrowerStarted',
    'DisputeLenderStarted',
    'DisputeBorrowerResolved',
    'DisputeLenderResolved'
    );

CREATE TYPE liquidation_status AS ENUM (
    'Healthy',
    'FirstMarginCall',
    'SecondMarginCall',
    'Liquidated'
    );

CREATE TABLE
    IF NOT EXISTS "contracts"
(
    id                      CHAR(36) PRIMARY KEY     NOT NULL,
    lender_id               CHAR(36)                 NOT NULL,
    borrower_id             CHAR(36)                 NOT NULL,
    loan_id                 CHAR(36)                 NOT NULL,
    initial_ltv             DECIMAL                  NOT NULL,
    initial_collateral_sats BIGINT                   NOT NULL,
    loan_amount             DECIMAL                  NOT NULL,
    duration_months         INT                      NOT NULL,
    borrower_btc_address    TEXT                     NOT NULL,
    borrower_pk             CHAR(66)                 NOT NULL,
    borrower_loan_address   TEXT                     NOT NULL,
    status                  contract_status          NOT NULL,
    liquidation_status      liquidation_status       NOT NULL,
    contract_address        TEXT,
    contract_index          INT,
    collateral_txid         TEXT,
    collateral_vout         INT,
    claim_txid              TEXT,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES lenders (id),
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id),
    FOREIGN KEY (loan_id) REFERENCES loan_offers (id)
);


CREATE TYPE dispute_status AS ENUM (
    'StartedBorrower',
    'StartedLender',
    'ResolvedBorrower',
    'ResolvedLender'
    );

CREATE TABLE DISPUTES
(
    id                   CHAR(36) PRIMARY KEY     NOT NULL,
    contract_id          CHAR(36)                 NOT NULL,
    borrower_id          CHAR(36)                 NOT NULL,
    lender_id            CHAR(36)                 NOT NULL,
    lender_payout_sats   BIGINT,
    borrower_payout_sats BIGINT,
    comment              VARCHAR(255)             NOT NULL DEFAULT '',
    status               dispute_status           NOT NULL,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES lenders (id),
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id),
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);
