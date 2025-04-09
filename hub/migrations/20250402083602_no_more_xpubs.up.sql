-- Loan offer changes. NOTE: We will drop lender_xpub` in a separate migration.

-- Temporarily set null values to a default value, so that we can replace them programmatically with Rust.
ALTER TABLE loan_offers ADD COLUMN lender_pk CHARACTER(
    66
) NOT NULL DEFAULT '031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f';

-- This only affects new contracts, so we can choose an arbitrary default value for existing offers.
-- The lender will set the new derivation path for new offers.
--
-- For these old loan offers, we will still use the `lender_xpub` to derive a non-hardened PK.
ALTER TABLE loan_offers ADD COLUMN lender_derivation_path TEXT NOT NULL DEFAULT 'm/586/0/0';

-- Relax constraint to be able to create new offers without a lender Xpub. Eventually we will just
-- remove the column.
ALTER TABLE loan_offers ALTER COLUMN lender_xpub DROP NOT NULL;

-- Temporarily set null values to a default value, so that we can replace them programmatically with Rust.
ALTER TABLE loan_offers ADD COLUMN lender_npub TEXT NOT NULL DEFAULT 'npub10qdcdts5j6h8gta0sx6qqnfjupurkrm7ljzayxpdklgpuan4sr9q7gucqd';

-- Loan application changes.

-- We only have 3 unused loan applications in prod. Let's drop them before running this migration.
DELETE FROM loan_applications;

ALTER TABLE loan_applications DROP COLUMN borrower_xpub;
ALTER TABLE loan_applications ADD COLUMN borrower_derivation_path TEXT NOT NULL;
ALTER TABLE loan_applications ADD COLUMN borrower_pk TEXT NOT NULL;
ALTER TABLE loan_applications ADD COLUMN borrower_npub TEXT NOT NULL;

-- Wallet backup changes.

ALTER TABLE borrower_wallet_backups DROP COLUMN xpub;
ALTER TABLE lender_wallet_backups DROP COLUMN xpub;

-- Contract changes. NOTE: We will drop `borrower_xpub` and `lender_xpub` in a separate migration.

ALTER TABLE contracts ADD COLUMN borrower_derivation_path TEXT;

-- Relax constraint to be able to create new contracts without a borrower Xpub. Eventually we will
-- just remove the column.
ALTER TABLE contracts ALTER COLUMN borrower_xpub DROP NOT NULL;

-- Set the value of `borrower_derivation_path` for post-2025/02/18 contracts to the correct
-- derivation path used in the multisig contract. Skip pre-2025/02/18 contracts, for which we do not know
-- the derivation path for certain.
UPDATE contracts
SET borrower_derivation_path = '586/0/' || contract_index::TEXT
WHERE contract_index IS NOT NULL AND created_at >= '2025-02-18';

ALTER TABLE contracts ADD COLUMN lender_derivation_path TEXT;

UPDATE contracts
SET lender_derivation_path = '586/0/' || contract_index::TEXT
WHERE contract_index IS NOT NULL;

-- This only applies to contracts that were never approved.
UPDATE contracts
SET lender_derivation_path = '586/0/0'
WHERE contract_index IS NULL;

ALTER TABLE contracts ALTER COLUMN lender_derivation_path SET NOT NULL;

-- Temporarily set null values to a default value, so that we can replace them programmatically with Rust.
ALTER TABLE contracts ADD COLUMN lender_pk CHARACTER(
    66
) NOT NULL DEFAULT '031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f';

-- Temporarily set null values to a default value, so that we can replace them programmatically with Rust.
UPDATE contracts
SET
    borrower_pk
    = '031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f'
WHERE borrower_pk IS NULL;

ALTER TABLE contracts ALTER COLUMN borrower_pk SET NOT NULL;

-- Temporarily set null values to a default value, so that we can replace them programmatically with Rust.
ALTER TABLE contracts ADD COLUMN borrower_npub TEXT NOT NULL DEFAULT 'npub10qdcdts5j6h8gta0sx6qqnfjupurkrm7ljzayxpdklgpuan4sr9q7gucqd';
ALTER TABLE contracts ADD COLUMN lender_npub TEXT NOT NULL DEFAULT 'npub10qdcdts5j6h8gta0sx6qqnfjupurkrm7ljzayxpdklgpuan4sr9q7gucqd';

-- Update views related to `contracts` table.

DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS inactive_contracts;
DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;
DROP VIEW IF EXISTS contracts_to_be_watched;

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
