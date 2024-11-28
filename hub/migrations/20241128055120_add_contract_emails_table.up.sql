CREATE TABLE contract_emails
(
    id                         SERIAL PRIMARY KEY,
    contract_id                CHAR(36)                 NOT NULL UNIQUE,
    loan_request_sent          BOOLEAN                  NOT NULL DEFAULT FALSE,
    loan_request_approved_sent BOOLEAN                  NOT NULL DEFAULT FALSE,
    loan_request_rejected_sent BOOLEAN                  NOT NULL DEFAULT FALSE,
    collateral_funded_sent     BOOLEAN                  NOT NULL DEFAULT FALSE,
    loan_paid_out_sent         BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);

INSERT INTO contract_emails (contract_id)
SELECT id FROM contracts;
