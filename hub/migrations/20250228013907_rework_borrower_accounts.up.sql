-- Introduce a table to store password authentication data for borrowers.
CREATE TABLE borrowers_password_auth (
    id SERIAL PRIMARY KEY,
    borrower_id CHARACTER(36) NOT NULL,
    email CHARACTER VARYING(255) NOT NULL,
    password CHARACTER VARYING(100),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code CHARACTER VARYING(255),
    password_reset_token CHARACTER VARYING(50),
    password_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    salt TEXT NOT NULL,
    verifier TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);

-- Move part of the data originally stored in `borrowers` table to new table.
INSERT INTO borrowers_password_auth (borrower_id, email, password, verified, verification_code, password_reset_token, password_reset_at, salt, verifier, created_at, updated_at)
SELECT id, email, password, verified, verification_code, password_reset_token, password_reset_at, salt, verifier, created_at, updated_at
FROM borrowers;

-- Remove view that references borrowers table.
DROP VIEW IF EXISTS borrower_discount_info;

-- Remove now redundant columns from `borrowers` table. The `email` column is kept because
-- eventually we can imagine having email addresses for borrowers that are not using password
-- authentication.
ALTER TABLE borrowers
ALTER COLUMN email DROP NOT NULL,
DROP COLUMN password,
DROP COLUMN verified,
DROP COLUMN verification_code,
DROP COLUMN password_reset_token,
DROP COLUMN password_reset_at,
DROP COLUMN salt,
DROP COLUMN verifier;

-- Recreate view.
CREATE VIEW borrower_discount_info AS
SELECT b.*,
       personal_referral_info.code AS personal_referral_code,
       was_referred.referral_code  AS used_referral_code,
       CASE
           WHEN (SELECT COUNT(*)
                 FROM contracts
                 WHERE borrower_id = b.id
                   AND id NOT IN (SELECT id FROM inactive_contracts)) > 0 THEN 0
           ELSE was_referred_rate.first_time_discount_rate_referee
           END                     AS first_time_discount_rate_referee
FROM borrowers b
         LEFT JOIN referral_codes_borrowers personal_referral_info ON personal_referral_info.referrer_id = b.id
         LEFT JOIN referred_borrowers was_referred ON was_referred.referred_borrower_id = b.id
         LEFT JOIN referral_codes_borrowers was_referred_rate ON was_referred_rate.code = was_referred.referral_code;

-- Introduce a table to manage API keys to create API accounts.
CREATE TABLE api_account_creator_api_keys (
    id                    SERIAL PRIMARY KEY,
    description           TEXT                     NOT NULL,
    api_key_hash          CHAR(64)                 NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_accounts_by_creators
(
    borrower_id CHARACTER(36) NOT NULL,
    creator_api_key SERIAL NOT NULL,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id),
    FOREIGN KEY (creator_api_key) REFERENCES api_account_creator_api_keys (id)
);

-- With the introduction of borrower API accounts, we cannot assume that we have a wallet backup in
-- the database, so we cannot always source the `borrower_xpub` from there. As such, we ensure that
-- the `borrower_xpub` column is always set in `contracts`.
--
-- To ensure that this migration succeeds in test and prod, we must first manually update all
-- contracts where the `borrower_xpub` is missing.
ALTER TABLE contracts
ALTER COLUMN borrower_xpub SET NOT NULL;
