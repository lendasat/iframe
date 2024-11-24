-- Step 1: Drop dependent table first
DROP TABLE IF EXISTS moon_invoice_payments CASCADE;

-- Step 2: Drop main table
DROP TABLE IF EXISTS moon_invoices CASCADE;

-- Step 3: Recreate the `moon_invoices` table
CREATE TABLE moon_invoices
(
    id              BIGINT PRIMARY KEY       NOT NULL,
    address         TEXT                     NOT NULL,
    usd_amount_owed DECIMAL                  NOT NULL,
    contract_id     CHAR(36)                 NOT NULL,
    lender_id       CHAR(36)                 NOT NULL,
    borrower_id     CHAR(36)                 NOT NULL,
    is_paid         BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id),
    FOREIGN KEY (lender_id) REFERENCES lenders (id),
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);

-- Step 4: Recreate the `moon_invoice_payments` table
CREATE TABLE moon_invoice_payments
(
    id         SERIAL PRIMARY KEY,
    invoice_id BIGINT                  NOT NULL,
    amount     DECIMAL                 NOT NULL,
    currency   CHAR(36)                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES moon_invoices (id)
);
