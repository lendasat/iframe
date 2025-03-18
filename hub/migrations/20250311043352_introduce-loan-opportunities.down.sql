-- Down Migration
-- 1. Add back the loan_id column and populate it
ALTER TABLE contracts
    ADD COLUMN loan_id CHAR(36);

UPDATE contracts c
SET loan_id = c.loan_deal_id
FROM loan_deals lo
WHERE c.loan_deal_id = lo.id
  AND lo.type = 'offer';


-- it's not possible to migrate `application` contracts as in the next step we will re-introduce the foreign key reference to `loan_offers`. Hence, we delete existing contracts which were created based on a `application`.
DELETE FROM contract_emails
WHERE contract_id IN (
    SELECT c.id
    FROM contracts c
             JOIN loan_deals lo ON c.loan_deal_id = lo.id
    WHERE lo.type = 'application'
);

DELETE FROM contracts c
WHERE EXISTS (
    SELECT 1
    FROM loan_deals lo
    WHERE c.loan_deal_id = lo.id
      AND lo.type = 'application'
);

-- 2. Add back the foreign key constraint
ALTER TABLE contracts
    ALTER COLUMN loan_id SET NOT NULL,
    ADD CONSTRAINT contracts_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loan_offers (id);



-- 3. Drop loan_deal_id from contracts
DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS inactive_contracts;
DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;
DROP VIEW IF EXISTS contracts_to_be_watched;

ALTER TABLE contracts
    DROP CONSTRAINT contracts_loan_deal_id_fkey,
    DROP COLUMN loan_deal_id;

ALTER TABLE contracts DROP COLUMN IF EXISTS lender_loan_repayment_address;

-- 4. Drop loan_deal_id from loan_applications
ALTER TABLE loan_applications
    DROP COLUMN loan_deal_id;

-- 5. Drop loan_deal_id from loan_offers
ALTER TABLE loan_offers
    DROP COLUMN loan_deal_id;

-- 6. Drop the loan_deals table
DROP TABLE loan_deals;

-- 7. Drop the loan_deal_type enum
DROP TYPE loan_deal_type;

-- now we can recreate the views

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

