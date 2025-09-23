-- Add range columns for loan amount and duration
ALTER TABLE loan_applications
ADD COLUMN loan_amount_min numeric,
ADD COLUMN loan_amount_max numeric,
ADD COLUMN duration_days_min integer,
ADD COLUMN duration_days_max integer;

-- Add check constraints to ensure min <= max
ALTER TABLE loan_applications
ADD CONSTRAINT loan_amount_range_check CHECK (
    (loan_amount_min IS NULL AND loan_amount_max IS NULL) OR
    (loan_amount_min IS NOT NULL AND loan_amount_max IS NOT NULL AND loan_amount_min <= loan_amount_max)
),
ADD CONSTRAINT duration_days_range_check CHECK (
    (duration_days_min IS NULL AND duration_days_max IS NULL) OR
    (duration_days_min IS NOT NULL AND duration_days_max IS NOT NULL AND duration_days_min <= duration_days_max)
);

-- Migrate existing data: set min and max to the current single values
UPDATE loan_applications
SET loan_amount_min = loan_amount,
    loan_amount_max = loan_amount,
    duration_days_min = duration_days,
    duration_days_max = duration_days;

-- Make the new columns NOT NULL after data migration
ALTER TABLE loan_applications
ALTER COLUMN loan_amount_min SET NOT NULL,
ALTER COLUMN loan_amount_max SET NOT NULL,
ALTER COLUMN duration_days_min SET NOT NULL,
ALTER COLUMN duration_days_max SET NOT NULL;

-- Drop the old single-value columns
ALTER TABLE loan_applications
DROP COLUMN loan_amount,
DROP COLUMN duration_days;