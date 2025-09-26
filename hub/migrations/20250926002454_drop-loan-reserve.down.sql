-- Step 1: Re-add the loan_amount_reserve column
ALTER TABLE loan_offers
    ADD COLUMN loan_amount_reserve DECIMAL NOT NULL DEFAULT 0;

-- Step 2: Restore loan_amount_reserve values
-- Set loan_amount_reserve = loan_amount_max + sum of active contracts' loan_amount
UPDATE loan_offers
SET loan_amount_reserve = loan_amount_max + COALESCE(
        (SELECT SUM(loan_amount)
         FROM contracts
         WHERE contracts.loan_deal_id = loan_offers.id
           AND status NOT IN ('Rejected', 'Cancelled', 'RequestExpired', 'ApprovalExpired', 'Extended')),
        0);

-- Step 3: Remove the default constraint
ALTER TABLE loan_offers
    ALTER COLUMN loan_amount_reserve DROP DEFAULT;

-- Note: The original loan_amount_max values cannot be perfectly restored 
-- since we don't know what they were before the up migration.
-- This down migration creates a functionally equivalent state.
