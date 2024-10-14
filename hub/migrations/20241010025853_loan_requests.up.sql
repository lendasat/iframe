CREATE TYPE loan_request_status AS ENUM ('Available', 'Unavailable', 'Deleted');

CREATE TABLE
    IF NOT EXISTS "loan_requests"
(
    id                    CHAR(36) PRIMARY KEY     NOT NULL,
    borrower_id           CHAR(36)                 NOT NULL,
    ltv                   DECIMAL                  NOT NULL,
    interest_rate         DECIMAL                  NOT NULL,
    loan_amount           DECIMAL                  NOT NULL,
    duration_months       INT                      NOT NULL,
    loan_asset_type       loan_asset_type          NOT NULL,
    loan_asset_chain      loan_asset_chain         NOT NULL,
    status                loan_request_status      NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);
