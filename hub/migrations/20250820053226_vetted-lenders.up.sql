-- Add vetted field to lenders table to indicate platform-verified lenders
ALTER TABLE lenders 
    ADD COLUMN vetted BOOLEAN NOT NULL DEFAULT FALSE;

-- Add an index for efficient filtering of vetted lenders
CREATE INDEX idx_lenders_vetted ON lenders(vetted) WHERE vetted = TRUE;
