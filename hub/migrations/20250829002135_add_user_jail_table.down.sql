-- Drop jail tables
DROP INDEX IF EXISTS idx_borrower_jail_lookup;
DROP INDEX IF EXISTS idx_lender_jail_lookup;

DROP TABLE IF EXISTS borrower_jail;
DROP TABLE IF EXISTS lender_jail;