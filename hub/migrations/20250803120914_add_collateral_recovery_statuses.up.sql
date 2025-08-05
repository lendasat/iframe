-- Drop contracts-related views for good, since they are unused in Rust.

DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;

-- Drop contracts-related views temporarily.
DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS contracts_to_be_watched;
DROP VIEW IF EXISTS inactive_contracts;

-- Add new enum values.
-- We need to commit the transaction after adding enum values before we can use them.

ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'CollateralRecoverable';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'ClosedByRecovery';

COMMIT;
BEGIN;

-- Recreate contracts-related views.

-- We are actually fixing a bug here: this view was omitting 'ApprovalExpired'.
CREATE VIEW inactive_contracts AS
SELECT *
FROM contracts
WHERE status IN ('Rejected', 'Cancelled', 'RequestExpired', 'ApprovalExpired');

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
       'RenewalRequested',
       'CollateralRecoverable');
