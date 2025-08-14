ALTER TABLE moon_invoices
    DROP COLUMN IF EXISTS expiry;

ALTER TABLE moon_invoices
    DROP COLUMN IF EXISTS crypto_amount_owed;
