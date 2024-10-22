-- Step 1: Rename the 'id' column to 'txid' and remove primary key
ALTER TABLE transactions
    RENAME COLUMN id TO txid;

-- Step 2: Remove uniqueness constraint from 'txid'
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS transactions_pkey;

-- Step 3: Add a new 'id' column that auto-generates values (BIGSERIAL)
ALTER TABLE transactions
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
