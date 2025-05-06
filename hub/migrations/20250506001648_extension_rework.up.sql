-- If this value is not positive, contracts originating from this offer cannot be extended by default.
ALTER TABLE loan_offers ADD COLUMN extension_duration_days INT NOT NULL DEFAULT 0;

-- We choose a high default interest rate in case the default value is ever applied unintentionally.
ALTER TABLE loan_offers ADD COLUMN extension_interest_rate DECIMAL NOT NULL DEFAULT 0.20;

-- Drop `contracts`-related views to reintroduce them later.

DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS inactive_contracts;
DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;
DROP VIEW IF EXISTS contracts_to_be_watched;

-- If this value is not positive, the contract cannot be extended.
ALTER TABLE contracts ADD COLUMN extension_duration_days INT NOT NULL DEFAULT 0;

-- We choose a high default interest rate in case the default value is ever applied unintentionally.
ALTER TABLE contracts ADD COLUMN extension_interest_rate DECIMAL NOT NULL DEFAULT 0.20;

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
