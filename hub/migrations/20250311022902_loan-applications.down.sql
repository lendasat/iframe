drop table loan_applications;

ALTER
    TYPE loan_application_status RENAME TO loan_request_status;

CREATE TABLE
    IF NOT EXISTS "loan_requests"
(
    id            CHAR(36) PRIMARY KEY     NOT NULL,
    borrower_id   CHAR(36)                 NOT NULL,
    ltv           DECIMAL                  NOT NULL,
    interest_rate DECIMAL                  NOT NULL,
    loan_amount   DECIMAL                  NOT NULL,
    duration_days INT                      NOT NULL,
    loan_asset    loan_asset               NOT NULL,
    loan_type     loan_type                not null,
    status        loan_request_status      NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);
