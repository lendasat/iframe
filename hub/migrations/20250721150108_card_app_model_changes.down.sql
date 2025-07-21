-- Drop contracts-related views
DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS inactive_contracts;
DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;
DROP VIEW IF EXISTS contracts_to_be_watched;

-- Remove late_penalty column from installments table
ALTER TABLE installments DROP COLUMN late_penalty;

-- Drop LatePenalty enum type
DROP TYPE IF EXISTS late_penalty;

-- Remove lender_btc_loan_repayment_address from contracts table
ALTER TABLE contracts DROP COLUMN lender_btc_loan_repayment_address;

-- Remove btc_loan_repayment_address from loan_offers table
ALTER TABLE loan_offers DROP COLUMN btc_loan_repayment_address;

-- Note: Cannot remove enum values from PostgreSQL enums in a straightforward way
-- The LoanType::MoonCardInstant and LoanPayout::MoonCardInstant values will remain
-- but should not be used after this migration is applied

-- Recreate contracts-related views

CREATE VIEW inactive_contracts AS
SELECT *
FROM contracts
WHERE status IN ('Rejected', 'Cancelled', 'RequestExpired');

CREATE VIEW closed_contracts AS
SELECT *
FROM contracts
WHERE status IN ('Closed', 'Extended', 'ClosedByLiquidation', 'ClosedByDefaulting');

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
