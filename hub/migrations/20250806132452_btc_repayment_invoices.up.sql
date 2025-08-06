CREATE TYPE btc_invoice_status AS ENUM ('Pending', 'Paid', 'Confirmed');

CREATE TABLE btc_invoices (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    installment_id UUID NOT NULL REFERENCES installments(id),
    amount_sats BIGINT NOT NULL,
    amount_usd DECIMAL NOT NULL,
    address TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status btc_invoice_status NOT NULL DEFAULT 'Pending',
    txid TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding invoices by installment
CREATE INDEX idx_btc_invoices_installment_id ON btc_invoices(installment_id);

-- Index for finding invoices by status and expiration (for cleanup tasks)
CREATE INDEX idx_btc_invoices_status_expires ON btc_invoices(status, expires_at);
