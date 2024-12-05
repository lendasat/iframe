-- First, remove duplicates, we are adding a constraints and need to fix duplicates
DELETE FROM moon_transaction_fees a
USING moon_transaction_fees b
WHERE a.id > b.id
  AND a.transaction_id = b.transaction_id
  AND a.fee_type = b.fee_type;

-- Then add the unique constraint
ALTER TABLE moon_transaction_fees
    ADD CONSTRAINT unique_transaction_fee
        UNIQUE (transaction_id, fee_type);

CREATE INDEX IF NOT EXISTS idx_moon_transaction_fees_transaction_id
    ON moon_transaction_fees (transaction_id);