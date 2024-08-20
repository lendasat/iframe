CREATE TYPE contract_status AS ENUM ('Open', 'Closed');

CREATE TABLE
    IF NOT EXISTS "contracts"
(
    id                      CHAR(36) PRIMARY KEY     NOT NULL,
    lender_id               CHAR(36)                 NOT NULL,
    borrower_id             CHAR(36)                 NOT NULL,
    loan_id                 CHAR(36)                 NOT NULL,
    initial_ltv             DECIMAL                  NOT NULL,
    initial_collateral_sats INT                      NOT NULL,
    loan_amount             DECIMAL                  NOT NULL,
    status                  contract_status          NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES users (id),
    FOREIGN KEY (borrower_id) REFERENCES users (id),
    FOREIGN KEY (loan_id) REFERENCES loan_offers (id)
);
