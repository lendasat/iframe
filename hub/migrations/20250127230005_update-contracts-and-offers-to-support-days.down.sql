ALTER TABLE loan_offers
    ADD COLUMN duration_months_min integer,
    ADD COLUMN duration_months_max integer;

-- Convert data back (divide by 30 to convert days to approximate months)
UPDATE loan_offers
SET duration_months_min = duration_days_min / 30,
    duration_months_max = duration_days_max / 30;

-- Make the restored columns not null after data is populated
ALTER TABLE loan_offers
ALTER
COLUMN duration_months_min SET NOT NULL,
    ALTER
COLUMN duration_months_max SET NOT NULL;

-- Drop the days columns
ALTER TABLE loan_offers
    DROP COLUMN duration_days_min,
DROP
COLUMN duration_days_max;

ALTER TABLE loan_requests
    ADD COLUMN duration_months integer;

-- Convert data back (divide by 30 to convert days to approximate months)
UPDATE loan_requests
SET duration_months = duration_days / 30;

-- Make the restored column not null after data is populated
ALTER TABLE loan_requests
    ALTER COLUMN duration_months SET NOT NULL;

-- Drop the days column
ALTER TABLE loan_requests
    DROP COLUMN duration_days;


--- we need to do the same thing for contracts

-- first drop old views because they depend on the table

DROP VIEW IF EXISTS contracts_to_be_watched CASCADE;
DROP VIEW IF EXISTS inactive_contracts CASCADE;
DROP VIEW IF EXISTS closed_contracts CASCADE;
DROP VIEW IF EXISTS open_contracts CASCADE;
DROP VIEW IF EXISTS expired_open_contracts CASCADE;
DROP VIEW IF EXISTS borrower_discount_info;

-- then make the roll back and rename the column

ALTER TABLE contracts
    ADD COLUMN duration_months integer;

-- Convert data back (divide by 30 to convert days to approximate months)
UPDATE contracts
SET duration_months = duration_days / 30;

-- Make the restored column not null after data is populated
ALTER TABLE contracts
    ALTER COLUMN duration_months SET NOT NULL;

-- Drop the days column
ALTER TABLE contracts
    DROP COLUMN duration_days;

-- and then recreate the views

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
                 WHERE borrower_id = b.id AND id NOT IN (SELECT id FROM inactive_contracts)) > 0 THEN 0
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

