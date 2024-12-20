-- Step 1: Add the column with a default value of NULL (or any constant)
ALTER TABLE loan_offers ADD COLUMN IF NOT EXISTS loan_amount_reserve DECIMAL NOT NULL DEFAULT 0;

-- Step 2: Populate the column with 1M for existing loans to not get to the limits yet
UPDATE loan_offers
SET loan_amount_reserve = 1000000;

-- Remove the default of 0
ALTER TABLE loan_offers ALTER COLUMN loan_amount_reserve DROP DEFAULT;
