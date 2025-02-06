-- Add `kyc_link` column to `loan_offers` table.
ALTER TABLE loan_offers ADD COLUMN kyc_link TEXT;

-- Add `kyc_offers` column to `lender_features` table. Only trusted lenders should have access to
-- this feature.
INSERT INTO lender_features (id, name, description, enabled)
VALUES ('kyc_offers', 'Create loan offers that require KYC', 'Create loan offers that require KYC', false);

-- If a borrower requests a contract based on an offer that requires KYC, a new row will be inserted
-- in the `kyc` table (if that borrower has not gone through KYC for that lender in the past).
CREATE TABLE kyc
(
    id                    SERIAL PRIMARY KEY,
    -- The party which requires KYC.
    lender_id             CHAR(36)                 NOT NULL,
    -- The party that has to complete a KYC process.
    borrower_id           CHAR(36)                 NOT NULL,
    is_done               BOOLEAN                  NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES lenders (id),
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id),
    CONSTRAINT one_kyc_per_borrower_lender_pair UNIQUE (lender_id, borrower_id)
);
