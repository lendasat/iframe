-- Add down migration script here
DROP TABLE IF EXISTS "lenders";
ALTER TABLE loan_offers
    DROP CONSTRAINT IF EXISTS loan_offers_lender_id_fkey;

ALTER TABLE loan_offers
    ADD CONSTRAINT loan_offers_lender_id_fkey
        FOREIGN KEY (lender_id) REFERENCES users (id);

ALTER TABLE contracts
    DROP CONSTRAINT IF EXISTS contracts_lender_id_fkey;

ALTER TABLE contracts
    ADD CONSTRAINT contracts_lender_id_fkey
        FOREIGN KEY (lender_id) REFERENCES users (id);
