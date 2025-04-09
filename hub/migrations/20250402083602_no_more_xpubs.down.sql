-- Drop `contracts`-related views to reintroduce them later.
DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS inactive_contracts;
DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;
DROP VIEW IF EXISTS contracts_to_be_watched;

ALTER TABLE contracts ALTER COLUMN borrower_pk DROP NOT NULL;

UPDATE contracts
SET borrower_pk = NULL
WHERE
    borrower_pk = '031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f';

ALTER TABLE contracts DROP COLUMN lender_pk;
ALTER TABLE contracts DROP COLUMN lender_derivation_path;
ALTER TABLE contracts DROP COLUMN borrower_derivation_path;

ALTER TABLE contracts DROP COLUMN borrower_npub;
ALTER TABLE contracts DROP COLUMN lender_npub;

ALTER TABLE contracts ALTER COLUMN borrower_xpub SET NOT NULL;

-- There is no good value to put here. If we revert the patch and run this migration script, sqlx
-- will complain because the lender's `xpub` will be expected.
ALTER TABLE lender_wallet_backups ADD COLUMN xpub TEXT;

-- There is no good value to put here. If we revert the patch and run this migration script, sqlx
-- will complain because the borrower's `xpub` will be expected.
ALTER TABLE borrower_wallet_backups ADD COLUMN xpub TEXT;

ALTER TABLE loan_applications DROP COLUMN borrower_pk;
ALTER TABLE loan_applications DROP COLUMN borrower_derivation_path;

ALTER TABLE loan_applications DROP COLUMN borrower_npub;

-- There is no good value to put here. If we revert the patch and run this migration script, sqlx
-- will complain because the loan application's `borrower_xpub` will be expected.
ALTER TABLE loan_applications ADD COLUMN borrower_xpub TEXT;

ALTER TABLE loan_offers DROP COLUMN lender_pk;
ALTER TABLE loan_offers DROP COLUMN lender_derivation_path;

ALTER TABLE loan_offers DROP COLUMN lender_npub;

ALTER TABLE loan_offers ALTER COLUMN lender_xpub SET NOT NULL;

-- Re-introduce views related to `contracts` table.
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
WHERE
    status IN
    (
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
        'RenewalRequested'
    );

CREATE VIEW expired_open_contracts AS
SELECT *
FROM contracts
WHERE
    expiry_date <= Now()
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
SELECT
    b.*,
    personal_referral_info.code AS personal_referral_code,
    was_referred.referral_code AS used_referral_code,
    CASE
        WHEN (
            SELECT COUNT(*)
            FROM contracts
            WHERE
                borrower_id = b.id
                AND id NOT IN (SELECT id FROM inactive_contracts)
        ) > 0 THEN 0
        ELSE was_referred_rate.first_time_discount_rate_referee
    END AS first_time_discount_rate_referee
FROM borrowers b
LEFT JOIN
    referral_codes_borrowers personal_referral_info
    ON personal_referral_info.referrer_id = b.id
LEFT JOIN
    referred_borrowers was_referred
    ON was_referred.referred_borrower_id = b.id
LEFT JOIN
    referral_codes_borrowers was_referred_rate
    ON was_referred_rate.code = was_referred.referral_code;

CREATE VIEW contracts_to_be_watched AS
SELECT *
FROM contracts
WHERE
    status IN
    (
        'Approved',
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
        'RenewalRequested'
    );
