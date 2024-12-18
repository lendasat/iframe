ALTER TABLE contracts ADD COLUMN expiry_date TIMESTAMP WITH TIME ZONE;

UPDATE contracts
SET expiry_date = created_at + (duration_months * INTERVAL '1 month')
WHERE expiry_date IS NULL;

ALTER TABLE contracts ALTER COLUMN expiry_date SET NOT NULL;
