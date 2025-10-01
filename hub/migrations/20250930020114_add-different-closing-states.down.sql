-- Add down migration script here

-- Update any contracts with the new closing states back to 'Closing'
UPDATE contracts
SET status = 'Closing'
WHERE status IN ('ClosingByClaim', 'ClosingByLiquidation', 'ClosingByDefaulting', 'ClosingByRecovery');

-- Note: PostgreSQL doesn't allow removing enum values
-- The new values will remain in the enum type but won't be used
