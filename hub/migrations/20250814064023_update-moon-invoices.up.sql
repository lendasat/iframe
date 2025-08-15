CREATE TYPE moon_invoice_asset AS ENUM ('UsdcPolygon', 'UsdtTron', 'BtcBitcoin');

ALTER TABLE moon_invoices
    ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

ALTER TABLE moon_invoices
    ADD COLUMN crypto_amount_owed DECIMAL NOT NULL DEFAULT 0.0;

ALTER TABLE moon_invoices
    ADD COLUMN lendasat_fee DECIMAL NOT NULL DEFAULT 0.0;

ALTER TABLE moon_invoices
    ADD COLUMN asset moon_invoice_asset NOT NULL DEFAULT 'UsdcPolygon';

ALTER TABLE moon_invoices
    DROP COLUMN lender_id;

-- Drop the foreign key constraint before renaming the column
ALTER TABLE moon_invoices
    DROP CONSTRAINT IF EXISTS moon_invoices_contract_id_fkey;

ALTER TABLE moon_invoices
    RENAME COLUMN contract_id to lendasat_id;
