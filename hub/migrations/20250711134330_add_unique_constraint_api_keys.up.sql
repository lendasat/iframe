-- Add new columns for key_id and salt
ALTER TABLE api_keys_borrower ADD COLUMN key_id VARCHAR(12) NOT NULL DEFAULT '';
ALTER TABLE api_keys_borrower ADD COLUMN salt BYTEA NOT NULL DEFAULT '';

ALTER TABLE api_keys_lender ADD COLUMN key_id VARCHAR(12) NOT NULL DEFAULT '';
ALTER TABLE api_keys_lender ADD COLUMN salt BYTEA NOT NULL DEFAULT '';

-- Add unique constraints to ensure API keys cannot be reused within the same user type
-- API keys must be unique among borrowers
ALTER TABLE api_keys_borrower ADD CONSTRAINT api_keys_borrower_api_key_hash_unique UNIQUE (api_key_hash);
ALTER TABLE api_keys_borrower ADD CONSTRAINT api_keys_borrower_key_id_unique UNIQUE (key_id);

-- API keys must be unique among lenders
ALTER TABLE api_keys_lender ADD CONSTRAINT api_keys_lender_api_key_hash_unique UNIQUE (api_key_hash);
ALTER TABLE api_keys_lender ADD CONSTRAINT api_keys_lender_key_id_unique UNIQUE (key_id);

-- Create indexes for faster lookup by key_id
CREATE INDEX idx_api_keys_borrower_key_id ON api_keys_borrower(key_id);
CREATE INDEX idx_api_keys_lender_key_id ON api_keys_lender(key_id);
