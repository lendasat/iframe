-- Step 1: Update loan_amount_max to preserve existing borrowing logic
-- Set loan_amount_max = MIN(existing loan_amount_max, remaining reserve)
-- where remaining reserve = loan_amount_reserve - sum of active contracts' loan_amount
UPDATE loan_offers
SET loan_amount_max = LEAST(
        loan_amount_max,
        GREATEST(0,
                 loan_amount_reserve - COALESCE(
                         (SELECT SUM(loan_amount)
                          FROM contracts
                          WHERE contracts.loan_deal_id = loan_offers.id
                            AND status NOT IN
                                ('Rejected', 'Cancelled', 'RequestExpired', 'ApprovalExpired', 'Extended')),
                         0)
        )
);

-- Step 2: Drop the loan_amount_reserve column since logic is now in loan_amount_max
ALTER TABLE loan_offers
    DROP COLUMN loan_amount_reserve;

-- Step 3: Set offers to Unavailable where loan_amount_max < loan_amount_min
-- Only update offers that were previously Available
UPDATE loan_offers
SET status = 'Unavailable'
WHERE loan_amount_max < loan_amount_min
  AND status = 'Available';
