-- UP SCRIPT
-----------

-- Function to generate a random string of specified length
CREATE OR REPLACE FUNCTION generate_random_string(length INTEGER) RETURNS TEXT AS
$$
DECLARE
    chars  TEXT    := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT    := '';
    i      INTEGER := 0;
BEGIN
    FOR i IN 1..length
        LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
        END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code() RETURNS TEXT AS
$$
DECLARE
    new_code    TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a 5-character random string and prepend 'LAS-'
        new_code := 'LAS-' || generate_random_string(5);

        -- Check if code exists
        SELECT EXISTS(SELECT 1
                      FROM referral_codes_borrowers
                      WHERE code = new_code)
        INTO code_exists;

        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;

    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Insert referral codes for borrowers who don't have one
DO
$$
    DECLARE
        borrower_record RECORD;
        -- we hardcode the date here so that we can delete it in the down script
        fixed_timestamp TIMESTAMP WITH TIME ZONE := '2025-01-31 00:00:00+00';
    BEGIN
        -- Loop through borrowers who don't have a referral code
        FOR borrower_record IN
            SELECT b.*
            FROM borrowers b
            WHERE NOT EXISTS (SELECT 1
                              FROM referral_codes_borrowers r
                              WHERE r.referrer_id = b.id)
            LOOP
                -- Insert new referral code
                INSERT INTO referral_codes_borrowers (code,
                                                      referrer_id,
                                                      active,
                                                      first_time_discount_rate_referee,
                                                      first_time_commission_rate_referrer,
                                                      commission_rate_referrer,
                                                      created_at,
                                                      expires_at)
                VALUES (generate_unique_referral_code(),
                        borrower_record.id,
                        true, -- Active by default
                        0.30, -- 10% discount for first-time referees
                        0.30, -- 5% commission for referrer on first-time
                        0.00, -- 2% commission for referrer on subsequent referrals
                        fixed_timestamp, -- Fixed timestamp for easy deletion
                        fixed_timestamp + INTERVAL '10 year' -- the referral code basically never expires.
                       );
            END LOOP;
    END
$$;

-- Clean up helper functions
DROP FUNCTION IF EXISTS generate_random_string;
DROP FUNCTION IF EXISTS generate_unique_referral_code;


DROP VIEW IF EXISTS borrower_discount_info;

CREATE VIEW borrower_discount_info AS
select b.*,
       was_referred.referral_code  as used_referral_code,
       CASE
           WHEN (SELECT COUNT(*)
                 FROM contracts
                 WHERE borrower_id = b.id
                   AND id NOT IN (SELECT id FROM inactive_contracts)) > 0 THEN 0
           ELSE was_referred_rate.first_time_discount_rate_referee
           END                     as first_time_discount_rate_referee
from borrowers b
         LEFT JOIN referred_borrowers was_referred ON was_referred.referred_borrower_id = b.id
         LEFT JOIN referral_codes_borrowers was_referred_rate ON was_referred_rate.code = was_referred.referral_code;
