-- Rename Closing to ClosingByClaim
-- This is in a separate migration because PostgreSQL doesn't allow using newly added enum values
-- in the same transaction where they are created

UPDATE contracts SET status = 'ClosingByClaim' WHERE status = 'Closing';