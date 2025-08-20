-- Remove the vetted field and its index
DROP INDEX IF EXISTS idx_lenders_vetted;

ALTER TABLE lenders 
    DROP COLUMN IF EXISTS vetted;
