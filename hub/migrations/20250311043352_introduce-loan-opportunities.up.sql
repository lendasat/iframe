-- Up Migration
-- Create an enum type for opportunity types
CREATE TYPE loan_deal_type AS ENUM ('offer', 'application');

-- Create the loan_deals table
CREATE TABLE loan_deals
(
    id         CHAR(36) PRIMARY KEY,
    type       loan_deal_type                                   NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Copy existing loan_offers IDs to loan_deals
INSERT INTO loan_deals (id, type, created_at)
SELECT id, 'offer', created_at
FROM loan_offers;

-- Add loan_deal_id column to loan_offers
ALTER TABLE loan_offers
    ADD COLUMN loan_deal_id CHAR(36) REFERENCES loan_deals (id);

-- Update loan_offers to reference their entries in loan_deals
UPDATE loan_offers
SET loan_deal_id = id;

-- Make the loan_deal_id NOT NULL after populating
ALTER TABLE loan_offers
    ALTER COLUMN loan_deal_id SET NOT NULL;

-- Add loan_deal_id column to loan_applications
-- Copy existing loan_offers IDs to loan_deals
INSERT INTO loan_deals (id, type, created_at)
SELECT id, 'application', created_at
FROM loan_applications;

ALTER TABLE loan_applications
    ADD COLUMN loan_deal_id CHAR(36) REFERENCES loan_deals (id);

-- Update loan_offers to reference their entries in loan_deals
UPDATE loan_applications
SET loan_deal_id = id;

-- Make the loan_deal_id NOT NULL after populating
ALTER TABLE loan_applications
    ALTER COLUMN loan_deal_id SET NOT NULL;

-- Update contracts table:
-- 1. Add loan_deal_id column
ALTER TABLE contracts
    ADD COLUMN loan_deal_id CHAR(36);

-- 2. Populate the loan_deal_id based on the loan_id (which currently references loan_offers)
UPDATE contracts
SET loan_deal_id = loan_id;

-- 3. Add foreign key constraint
ALTER TABLE contracts
    ADD CONSTRAINT contracts_loan_deal_id_fkey
        FOREIGN KEY (loan_deal_id) REFERENCES loan_deals (id);

-- 4. Make loan_deal_id NOT NULL after populating
ALTER TABLE contracts
    ALTER COLUMN loan_deal_id SET NOT NULL;

-- 5. Drop the old foreign key constraint and drop loan_id column
ALTER TABLE contracts
    DROP CONSTRAINT contracts_loan_id_fkey;

-- we need to drop the views as they depend on loan_id

DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS inactive_contracts;
DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;
DROP VIEW IF EXISTS contracts_to_be_watched;

ALTER TABLE contracts
    DROP COLUMN loan_id;

ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS lender_loan_repayment_address TEXT;

CREATE VIEW inactive_contracts AS
SELECT *
FROM contracts
WHERE status IN ('Rejected', 'Cancelled', 'RequestExpired');

CREATE VIEW closed_contracts AS
SELECT *
FROM contracts
WHERE status IN ('Closed', 'Extended');

CREATE VIEW open_contracts AS
SELECT *
FROM contracts
WHERE status IN
      ('CollateralSeen',
       'CollateralConfirmed',
       'PrincipalGiven',
       'RepaymentProvided',
       'RepaymentConfirmed',
       'Closing',
       'DisputeBorrowerStarted',
       'DisputeLenderStarted',
       'DisputeBorrowerResolved',
       'DisputeLenderResolved',
       'Defaulted',
       'Undercollateralized',
       'RenewalRequested');

CREATE VIEW expired_open_contracts AS
SELECT *
FROM contracts
WHERE expiry_date <= Now()
  AND status IN
      (
       'CollateralSeen',
       'CollateralConfirmed',
       'PrincipalGiven',
       'RenewalRequested',
       'DisputeBorrowerStarted',
       'DisputeLenderStarted',
       'DisputeBorrowerResolved',
       'DisputeLenderResolved',
       'Defaulted',
       'Undercollateralized'
          );


CREATE VIEW borrower_discount_info AS
select b.*,
       personal_referral_info.code as personal_referral_code,
       was_referred.referral_code  as used_referral_code,
       CASE
           WHEN (SELECT COUNT(*)
                 FROM contracts
                 WHERE borrower_id = b.id
                   AND id NOT IN (SELECT id FROM inactive_contracts)) > 0 THEN 0
           ELSE was_referred_rate.first_time_discount_rate_referee
           END                     as first_time_discount_rate_referee
from borrowers b
         left join referral_codes_borrowers personal_referral_info on personal_referral_info.referrer_id = b.id
         LEFT JOIN referred_borrowers was_referred ON was_referred.referred_borrower_id = b.id
         LEFT JOIN referral_codes_borrowers was_referred_rate ON was_referred_rate.code = was_referred.referral_code;

CREATE VIEW contracts_to_be_watched AS
SELECT *
FROM contracts
WHERE status IN
      ('Approved',
       'CollateralSeen',
       'CollateralConfirmed',
       'PrincipalGiven',
       'RepaymentProvided',
       'RepaymentConfirmed',
       'Closing',
       'DisputeBorrowerStarted',
       'DisputeLenderStarted',
       'DisputeBorrowerResolved',
       'DisputeLenderResolved',
       'Defaulted',
       'Undercollateralized',
       'RenewalRequested');

