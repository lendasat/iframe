ALTER TABLE moon_invoices
    DROP COLUMN IF EXISTS expires_at;

ALTER TABLE moon_invoices
    DROP COLUMN IF EXISTS crypto_amount_owed;

ALTER TABLE moon_invoices
    DROP COLUMN IF EXISTS lendasat_fee;

ALTER TABLE moon_invoices
    DROP COLUMN IF EXISTS asset;

DROP TYPE IF EXISTS moon_invoice_asset;

-- First add the column as nullable
ALTER TABLE moon_invoices
    ADD COLUMN lender_id CHAR(36) REFERENCES lenders (id);

-- Rename the column back
ALTER TABLE moon_invoices
    RENAME COLUMN lendasat_id to contract_id;

-- Re-add the foreign key constraint
ALTER TABLE moon_invoices
    ADD CONSTRAINT moon_invoices_contract_id_fkey
        FOREIGN KEY (contract_id) REFERENCES contracts (id);

-- Populate lender_id from the contracts table using contract_id
UPDATE moon_invoices mi
SET lender_id = c.lender_id
FROM contracts c
WHERE mi.contract_id = c.id;

-- Now make it NOT NULL after it's been populated
ALTER TABLE moon_invoices
    ALTER COLUMN lender_id SET NOT NULL;
