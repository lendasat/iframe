DROP TABLE IF EXISTS referred_borrowers;
DROP TABLE IF EXISTS referral_codes_borrowers;
ALTER TABLE borrowers
    ADD COLUMN IF NOT EXISTS invite_code INT REFERENCES invite_codes_borrower (id);


        DELETE
        FROM borrowers
        WHERE email = 'satoshis.mother@lendasat.com';