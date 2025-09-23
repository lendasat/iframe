-- Add back the original single-value columns
ALTER TABLE loan_applications
ADD COLUMN loan_amount numeric,
ADD COLUMN duration_days integer;

-- Migrate data back: use the min values as defaults (or could use max or average)
UPDATE loan_applications
SET loan_amount = loan_amount_min,
    duration_days = duration_days_min;

-- Make the columns NOT NULL after data migration
ALTER TABLE loan_applications
ALTER COLUMN loan_amount SET NOT NULL,
ALTER COLUMN duration_days SET NOT NULL;

-- Drop the check constraints
ALTER TABLE loan_applications
DROP CONSTRAINT IF EXISTS loan_amount_range_check,
DROP CONSTRAINT IF EXISTS duration_days_range_check;

-- Drop the range columns
ALTER TABLE loan_applications
DROP COLUMN loan_amount_min,
DROP COLUMN loan_amount_max,
DROP COLUMN duration_days_min,
DROP COLUMN duration_days_max;
