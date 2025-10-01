-- Add up migration script here

-- Add the new enum values
-- Note: We keep 'Closing' and add 'ClosingByClaim' as a new value
-- The renaming will happen in a separate migration to avoid transaction issues
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'ClosingByClaim' AFTER 'RepaymentConfirmed';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'ClosingByLiquidation' AFTER 'ClosingByClaim';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'ClosingByDefaulting' AFTER 'ClosingByLiquidation';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'ClosingByRecovery' AFTER 'ClosingByDefaulting';
