BEGIN;

-- Drop all views that depend on `contracts` table.
DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS contracts_to_be_watched CASCADE;
DROP VIEW IF EXISTS inactive_contracts CASCADE;
DROP VIEW IF EXISTS closed_contracts CASCADE;
DROP VIEW IF EXISTS open_contracts CASCADE;
DROP VIEW IF EXISTS expired_open_contracts CASCADE;

-- Reintroduce NOT NULL constraint for `borrower_loan_address` in `contracts` table.
ALTER TABLE contracts ALTER COLUMN borrower_loan_address SET NOT NULL;

-- Reintroduce NOT NULL constraint for `borrower_pk` in `contracts` table.
-- We might have some null values for borrower_pk in our DB, for those we set dummy values
-- This shouldn't matter in production because we don't use revert-migrations
UPDATE contracts SET borrower_pk = '032e58afe51f9ed8ad3cc7897f634d881fdbe49a81564629ded8156bebd2ffd1af' WHERE borrower_pk IS NULL;
ALTER TABLE contracts ALTER COLUMN borrower_pk SET NOT NULL;

-- Drop `borrower_xpub` column from `contracts`.
ALTER TABLE contracts DROP COLUMN borrower_xpub;

-- Rename `contracts` table `loan_type` column back to `integration`.
ALTER TABLE contracts RENAME COLUMN loan_type TO integration;

-- Remake all the views that were dropped.

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

-- Rename `loan_type` type back to `integration`.
ALTER TYPE loan_type RENAME to integration;

-- Cannot easily remove newly added `Fiat` variant, so skipping.

-- Drop NOT NULL constraint for `lender_xpub` of `loan_offers` table.
ALTER TABLE loan_offers ALTER COLUMN lender_xpub DROP NOT NULL;

-- Drop new tables.
DROP TABLE IF EXISTS fiat_loan_details_borrower;
DROP TABLE IF EXISTS fiat_loan_details_lender;

-- Reintroduce old types. We add unknown for new fiat types
CREATE TYPE loan_asset_type AS ENUM ('Usdc', 'Usdt', 'Unknown');
CREATE TYPE loan_asset_chain AS ENUM ('Ethereum', 'Starknet', 'Polygon', 'Solana', 'Unknown');

-- Revert changes to `loan_requests` table.

ALTER TABLE loan_requests ADD COLUMN loan_asset_type loan_asset_type DEFAULT 'Unknown';
ALTER TABLE loan_requests ADD COLUMN loan_asset_chain loan_asset_chain DEFAULT 'Unknown';

UPDATE loan_requests
SET loan_asset_type =
        CASE
            WHEN loan_asset = 'UsdcPol' THEN 'Usdc'::loan_asset_type
            WHEN loan_asset = 'UsdtPol' THEN 'Usdt'::loan_asset_type
            WHEN loan_asset = 'UsdcEth' THEN 'Usdc'::loan_asset_type
            WHEN loan_asset = 'UsdtEth' THEN 'Usdt'::loan_asset_type
            WHEN loan_asset = 'UsdcStrk' THEN 'Usdc'::loan_asset_type
            WHEN loan_asset = 'UsdtStrk' THEN 'Usdt'::loan_asset_type
            WHEN loan_asset = 'UsdcSol' THEN 'Usdc'::loan_asset_type
            WHEN loan_asset = 'UsdtSol' THEN 'Usdt'::loan_asset_type
            ELSE 'Unknown'::loan_asset_type
            END;

UPDATE loan_requests
SET loan_asset_chain =
        CASE
            WHEN loan_asset = 'UsdcPol' THEN 'Polygon'::loan_asset_chain
            WHEN loan_asset = 'UsdtPol' THEN 'Polygon'::loan_asset_chain
            WHEN loan_asset = 'UsdcEth' THEN 'Ethereum'::loan_asset_chain
            WHEN loan_asset = 'UsdtEth' THEN 'Ethereum'::loan_asset_chain
            WHEN loan_asset = 'UsdcStrk' THEN 'Starknet'::loan_asset_chain
            WHEN loan_asset = 'UsdtStrk' THEN 'Starknet'::loan_asset_chain
            WHEN loan_asset = 'UsdcSol' THEN 'Solana'::loan_asset_chain
            WHEN loan_asset = 'UsdtSol' THEN 'Solana'::loan_asset_chain
            ELSE 'Unknown'::loan_asset_chain
END;

ALTER TABLE loan_requests DROP COLUMN loan_asset;

ALTER TABLE loan_requests ALTER COLUMN loan_asset_type SET NOT NULL;
ALTER TABLE loan_requests ALTER COLUMN loan_asset_chain SET NOT NULL;

-- Revert changes to `loan_offers` table.

ALTER TABLE loan_offers ADD COLUMN loan_asset_type loan_asset_type;
ALTER TABLE loan_offers ADD COLUMN loan_asset_chain loan_asset_chain;

UPDATE loan_offers
SET loan_asset_type =
    CASE
        WHEN loan_asset = 'UsdcPol' THEN 'Usdc'::loan_asset_type
        WHEN loan_asset = 'UsdtPol' THEN 'Usdt'::loan_asset_type
        WHEN loan_asset = 'UsdcEth' THEN 'Usdc'::loan_asset_type
        WHEN loan_asset = 'UsdtEth' THEN 'Usdt'::loan_asset_type
        WHEN loan_asset = 'UsdcStrk' THEN 'Usdc'::loan_asset_type
        WHEN loan_asset = 'UsdtStrk' THEN 'Usdt'::loan_asset_type
        WHEN loan_asset = 'UsdcSol' THEN 'Usdc'::loan_asset_type
        WHEN loan_asset = 'UsdtSol' THEN 'Usdt'::loan_asset_type
        ELSE 'Unknown'::loan_asset_type
    END;

UPDATE loan_offers
SET loan_asset_chain =
    CASE
        WHEN loan_asset = 'UsdcPol' THEN 'Polygon'::loan_asset_chain
        WHEN loan_asset = 'UsdtPol' THEN 'Polygon'::loan_asset_chain
        WHEN loan_asset = 'UsdcEth' THEN 'Ethereum'::loan_asset_chain
        WHEN loan_asset = 'UsdtEth' THEN 'Ethereum'::loan_asset_chain
        WHEN loan_asset = 'UsdcStrk' THEN 'Starknet'::loan_asset_chain
        WHEN loan_asset = 'UsdtStrk' THEN 'Starknet'::loan_asset_chain
        WHEN loan_asset = 'UsdcSol' THEN 'Solana'::loan_asset_chain
        WHEN loan_asset = 'UsdtSol' THEN 'Solana'::loan_asset_chain
        ELSE 'Unknown'::loan_asset_chain
    END;

ALTER TABLE loan_offers DROP COLUMN loan_asset;

ALTER TABLE loan_offers ALTER COLUMN loan_asset_type SET NOT NULL;
ALTER TABLE loan_offers ALTER COLUMN loan_asset_chain SET NOT NULL;

-- Drop new type.
DROP TYPE IF EXISTS loan_asset;

COMMIT;
