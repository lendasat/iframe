DROP INDEX IF EXISTS idx_moon_transaction_fees_transaction_id;
ALTER TABLE moon_transaction_fees
    DROP CONSTRAINT IF EXISTS unique_transaction_fee;
