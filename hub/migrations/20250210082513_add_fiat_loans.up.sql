BEGIN ;

-- Introduce new type to unify `loan_asset_type` and `loan_asset_chain`.

CREATE TYPE loan_asset AS ENUM (
    'UsdcPol',
    'UsdtPol',
    'UsdcEth',
    'UsdtEth',
    'UsdcStrk',
    'UsdtStrk',
    'UsdcSol',
    'UsdtSol',
    'Usd',
    'Eur',
    'Chf',
    'Unknown'
);

-- Add `loan_asset` as a column to `loan_offers`. It's nullable so that we don't need to provide a
-- default value.
ALTER TABLE loan_offers ADD COLUMN loan_asset loan_asset;

-- Map existing entries in `loan_offers` table from `loan_asset_type` and `loan_asset_chain` to just
-- `loan_asset`.
UPDATE loan_offers
SET loan_asset =
    CASE
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Polygon' THEN 'UsdcPol'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Polygon' THEN 'UsdtPol'::loan_asset
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Ethereum' THEN 'UsdcEth'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Ethereum' THEN 'UsdtEth'::loan_asset
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Starknet' THEN 'UsdcStrk'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Starknet' THEN 'UsdtStrk'::loan_asset
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Solana' THEN 'UsdcSol'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Solana' THEN 'UsdtSol'::loan_asset
        else 'Unknown'
    END;

-- Now that every `loan_asset` column has been filled, ensure that the column cannot be null.
ALTER TABLE loan_offers ALTER COLUMN loan_asset SET NOT NULL;

-- Remove now redundant columns from `loan_offers` table.
ALTER TABLE loan_offers DROP COLUMN loan_asset_type;
ALTER TABLE loan_offers DROP COLUMN loan_asset_chain;

-- Add `loan_asset` as a column to `loan_requests`. It's nullable so that we don't need to provide a
-- default value.
ALTER TABLE loan_requests ADD COLUMN loan_asset loan_asset;

-- Map existing entries in `loan_requests` table from `loan_asset_type` and `loan_asset_chain` to
-- just `loan_asset`.
UPDATE loan_requests
SET loan_asset =
    CASE
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Polygon' THEN 'UsdcPol'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Polygon' THEN 'UsdtPol'::loan_asset
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Ethereum' THEN 'UsdcEth'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Ethereum' THEN 'UsdtEth'::loan_asset
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Starknet' THEN 'UsdcStrk'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Starknet' THEN 'UsdtStrk'::loan_asset
        WHEN loan_asset_type = 'Usdc' AND loan_asset_chain = 'Solana' THEN 'UsdcSol'::loan_asset
        WHEN loan_asset_type = 'Usdt' AND loan_asset_chain = 'Solana' THEN 'UsdtSol'::loan_asset
        else 'Unknown'
    END;

-- Now that every `loan_asset` column has been filled, ensure that the column cannot be null.
ALTER TABLE loan_requests ALTER COLUMN loan_asset SET NOT NULL;

-- Remove now redundant columns from `loan_requests` table.
ALTER TABLE loan_requests DROP COLUMN loan_asset_type;
ALTER TABLE loan_requests DROP COLUMN loan_asset_chain;

-- Remove now unused types `loan_asset_type` and `loan_asset_chain`.
DROP TYPE IF EXISTS loan_asset_type;
DROP TYPE IF EXISTS loan_asset_chain;

-- Add `fiat_loan_details_borrower` table.
CREATE TABLE fiat_loan_details_borrower
(
    id                                SERIAL PRIMARY KEY,
    contract_id                       CHAR(36)                 NOT NULL,
    iban                              TEXT,
    bic                               TEXT,
    account_number                    TEXT,
    swift_or_bic                      TEXT,
    bank_name                         TEXT                     NOT NULL,
    bank_address                      TEXT                     NOT NULL,
    bank_country                      TEXT                     NOT NULL,
    purpose_of_remittance             TEXT                     NOT NULL,
    full_name                         TEXT                     NOT NULL,
    address                           TEXT                     NOT NULL,
    city                              TEXT                     NOT NULL,
    post_code                         TEXT                     NOT NULL,
    country                           TEXT                     NOT NULL,
    comments                          TEXT,
    encrypted_encryption_key_borrower TEXT                     NOT NULL,
    encrypted_encryption_key_lender   TEXT                     NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id),
    UNIQUE (contract_id)
);

-- Add `fiat_loan_details_lender` table.
CREATE TABLE fiat_loan_details_lender
(
    id                                SERIAL PRIMARY KEY,
    contract_id                       CHAR(36)                 NOT NULL,
    iban                              TEXT,
    bic                               TEXT,
    account_number                    TEXT,
    swift_or_bic                      TEXT,
    bank_name                         TEXT                     NOT NULL,
    bank_address                      TEXT                     NOT NULL,
    bank_country                      TEXT                     NOT NULL,
    purpose_of_remittance             TEXT                     NOT NULL,
    full_name                         TEXT                     NOT NULL,
    address                           TEXT                     NOT NULL,
    city                              TEXT                     NOT NULL,
    post_code                         TEXT                     NOT NULL,
    country                           TEXT                     NOT NULL,
    comments                          TEXT,
    encrypted_encryption_key_borrower TEXT                     NOT NULL,
    encrypted_encryption_key_lender   TEXT                     NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id),
    UNIQUE (contract_id)
);

-- I have manually ensured that both production and test do not include any `loan_offers` rows
-- without a `lender_xpub`.
ALTER TABLE loan_offers ALTER COLUMN lender_xpub SET NOT NULL;

-- Rename `integration` type to `loan_type`.
ALTER TYPE integration RENAME TO loan_type;

-- Add `Fiat` variant to `loan_type`.
ALTER TYPE loan_type ADD VALUE IF NOT EXISTS 'Fiat';

-- Drop all views that depend on `contracts` table.
DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS contracts_to_be_watched CASCADE;
DROP VIEW IF EXISTS inactive_contracts CASCADE;
DROP VIEW IF EXISTS closed_contracts CASCADE;
DROP VIEW IF EXISTS open_contracts CASCADE;
DROP VIEW IF EXISTS expired_open_contracts CASCADE;

-- Rename `contracts` table `integration` column to `loan_type`.
ALTER TABLE contracts RENAME COLUMN integration TO loan_type;

-- Add `borrower_xpub` column to `contracts`. We will use this to derive borrower PKs. It's nullable
-- for backwards compatibility.
ALTER TABLE contracts ADD COLUMN borrower_xpub TEXT;

-- Drop NOT NULL constraint for `borrower_pk` in `contracts` table. This is getting replaced by
-- `borrower_xpub`. It's nullable for backwards compatibility.
ALTER TABLE contracts ALTER COLUMN borrower_pk DROP NOT NULL;

-- Drop NOT NULL constraint for `borrower_loan_address` in `contracts` table. A fiat loan will not
-- have a `borrower_loan_address`.
ALTER TABLE contracts ALTER COLUMN borrower_loan_address DROP NOT NULL;

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

COMMIT;
