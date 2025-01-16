ALTER TABLE borrowers DROP COLUMN salt;
ALTER TABLE lenders DROP COLUMN salt;

ALTER TABLE borrowers DROP COLUMN verifier;
ALTER TABLE lenders DROP COLUMN verifier;

ALTER TABLE borrowers ALTER COLUMN password SET NOT NULL;
ALTER TABLE lenders ALTER COLUMN password SET NOT NULL;

ALTER TABLE borrower_wallet_backups ALTER COLUMN passphrase_hash SET NOT NULL;
ALTER TABLE lender_wallet_backups ALTER COLUMN passphrase_hash SET NOT NULL;

ALTER TABLE borrower_wallet_backups ADD CONSTRAINT IF EXISTS borrower_wallet_backups_borrower_id_key UNIQUE (borrower_id);
ALTER TABLE lender_wallet_backups ADD CONSTRAINT IF EXISTS lender_wallet_backups_lender_id_key UNIQUE (lender_id);

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
