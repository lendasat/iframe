ALTER TABLE contracts
ALTER COLUMN borrower_xpub DROP NOT NULL;

DROP TABLE IF EXISTS api_accounts_by_creators;
DROP TABLE IF EXISTS api_account_creator_api_keys;

DROP VIEW IF EXISTS borrower_discount_info;

ALTER TABLE borrowers
ADD COLUMN password CHARACTER VARYING(100),
ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN verification_code CHARACTER VARYING(255),
ADD COLUMN password_reset_token CHARACTER VARYING(50),
ADD COLUMN password_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN salt TEXT,
ADD COLUMN verifier TEXT;

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

UPDATE borrowers b
SET
    email = COALESCE(bpa.email, 'default@example.com'),
    password = bpa.password,
    verified = bpa.verified,
    verification_code = bpa.verification_code,
    password_reset_token = bpa.password_reset_token,
    password_reset_at = bpa.password_reset_at,
    salt = bpa.salt,
    verifier = bpa.verifier
FROM borrowers_password_auth bpa
WHERE bpa.borrower_id = b.id;

UPDATE borrowers
SET email = 'default@example.com'
WHERE email IS NULL;

UPDATE borrowers
SET salt = '0'
WHERE salt IS NULL;

UPDATE borrowers
SET verifier = '0'
WHERE verifier IS NULL;

ALTER TABLE borrowers
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN salt SET NOT NULL,
ALTER COLUMN verifier SET NOT NULL;

DROP TABLE IF EXISTS borrowers_password_auth;
