-- The salt and verifier are the two things that the hub must store to allow the client to
-- authenticate via PAKE.
--
-- After upgrading an old client, we will replace the zeros with real values.
ALTER TABLE borrowers ADD COLUMN salt TEXT NOT NULL DEFAULT '0';
ALTER TABLE lenders ADD COLUMN salt TEXT NOT NULL DEFAULT '0';

ALTER TABLE borrowers ADD COLUMN verifier TEXT NOT NULL DEFAULT '0';
ALTER TABLE lenders ADD COLUMN verifier TEXT NOT NULL DEFAULT '0';

-- We will not store a passsword hash for new accounts. We keep it for old accounts to be able to
-- authenticate before upgrading them to PAKE.
ALTER TABLE borrowers ALTER COLUMN password DROP NOT NULL;
ALTER TABLE lenders ALTER COLUMN password DROP NOT NULL;

ALTER TABLE borrower_wallet_backups ALTER COLUMN passphrase_hash DROP NOT NULL;
ALTER TABLE lender_wallet_backups ALTER COLUMN passphrase_hash DROP NOT NULL;

-- We want to keep around old backups just in case. That means that we can have multiple entries per
-- borrower/lender now.
ALTER TABLE borrower_wallet_backups DROP CONSTRAINT IF EXISTS borrower_wallet_backups_borrower_id_key;
ALTER TABLE lender_wallet_backups DROP CONSTRAINT IF EXISTS lender_wallet_backups_lender_id_key;

-- Update any views referencing the modified tables.
DROP VIEW IF EXISTS borrower_discount_info;
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
