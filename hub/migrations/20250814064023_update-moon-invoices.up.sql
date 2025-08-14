ALTER TABLE moon_invoices
    ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

ALTER TABLE moon_invoices
    ADD COLUMN crypto_amount_owed DECIMAL NOT NULL DEFAULT 0.0;
