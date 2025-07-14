-- Drop indexes
DROP INDEX idx_api_keys_borrower_key_id;
DROP INDEX idx_api_keys_lender_key_id;

-- Remove unique constraints
ALTER TABLE api_keys_borrower DROP CONSTRAINT api_keys_borrower_api_key_hash_unique;
ALTER TABLE api_keys_borrower DROP CONSTRAINT api_keys_borrower_key_id_unique;
ALTER TABLE api_keys_lender DROP CONSTRAINT api_keys_lender_api_key_hash_unique;
ALTER TABLE api_keys_lender DROP CONSTRAINT api_keys_lender_key_id_unique;

-- Remove columns
ALTER TABLE api_keys_borrower DROP COLUMN key_id;
ALTER TABLE api_keys_borrower DROP COLUMN salt;
ALTER TABLE api_keys_lender DROP COLUMN key_id;
ALTER TABLE api_keys_lender DROP COLUMN salt;
