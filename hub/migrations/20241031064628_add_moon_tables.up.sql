CREATE TABLE moon_cards
(
    id                      CHAR(36) PRIMARY KEY     NOT NULL,
    balance                 DECIMAL                  NOT NULL,
    available_balance       DECIMAL                  NOT NULL,
    expiration              TIMESTAMP WITH TIME ZONE NOT NULL,
    pan                     TEXT                     NOT NULL,
    cvv                     TEXT                     NOT NULL,
    support_token           TEXT                     NOT NULL,
    product_id              CHAR(36)                 NOT NULL,
    end_customer_id         TEXT                     NOT NULL,
    contract_id             CHAR(36)                 NOT NULL,
    borrower_id             CHAR(36)                 NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id),
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);

CREATE TABLE moon_invoices
(
    id                      BIGINT PRIMARY KEY       NOT NULL,
    address                 TEXT                     NOT NULL,
    usd_amount_owed         DECIMAL                  NOT NULL,
    contract_id             CHAR(36)                 NOT NULL,
    lender_id               CHAR(36)                 NOT NULL,
    is_paid                 BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id),
    FOREIGN KEY (lender_id)   REFERENCES lenders   (id)
);

CREATE TABLE moon_invoice_payments
(
    id         SERIAL PRIMARY KEY,
    invoice_id INT                      NOT NULL,
    amount     DECIMAL                  NOT NULL,
    currency   CHAR(36)                 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
