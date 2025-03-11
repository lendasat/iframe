-- this is safe because we don't care about old requests in production.
drop table loan_requests;

ALTER
    TYPE loan_request_status RENAME TO loan_application_status;

ALTER TYPE loan_application_status ADD VALUE IF NOT EXISTS 'Taken';

CREATE TABLE
    IF NOT EXISTS "loan_applications"
(
    id                    CHAR(36) PRIMARY KEY     NOT NULL,
    borrower_id           CHAR(36)                 NOT NULL,
    ltv                   DECIMAL                  NOT NULL,
    interest_rate         DECIMAL                  NOT NULL,
    loan_amount           DECIMAL                  NOT NULL,
    duration_days       INT                      NOT NULL,
    loan_asset            loan_asset               NOT NULL,
    loan_type             loan_type                not null,
    status                loan_application_status  NOT NULL,
    borrower_loan_address text,
    borrower_btc_address  text                     not null,
    borrower_xpub         text                     not null,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);


