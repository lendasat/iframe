-- First add the column allowing nulls initially
ALTER TABLE contracts
    ADD COLUMN interest_rate numeric;

-- Copy the data from loan_offers
UPDATE contracts c
SET interest_rate = lo.interest_rate
FROM loan_offers lo
WHERE c.loan_id = lo.id;

-- Make the column not null after populating it
ALTER TABLE contracts
ALTER
COLUMN interest_rate SET NOT NULL;
