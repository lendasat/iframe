CREATE TABLE referral_codes_borrowers
(
    code                                VARCHAR(20)              NOT NULL PRIMARY KEY,
    referrer_id                         CHAR(36)                 NOT NULL,
    active                              BOOLEAN                  NOT NULL,
    first_time_discount_rate_referee    DECIMAL                  NOT NULL,
    first_time_commission_rate_referrer DECIMAL                  NOT NULL,
    commission_rate_referrer            DECIMAL                  NOT NULL,
    created_at                          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at                          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 year',
    FOREIGN KEY (referrer_id) REFERENCES borrowers (id)
);

CREATE TABLE referred_borrowers
(
    id                   SERIAL PRIMARY KEY,
    referral_code        VARCHAR(20)              NOT NULL,
    referred_borrower_id CHAR(36)                 NOT NULL UNIQUE,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_code) REFERENCES referral_codes_borrowers (code),
    FOREIGN KEY (referred_borrower_id) REFERENCES borrowers (id)
);

ALTER TABLE borrowers
    DROP COLUMN IF EXISTS invite_code;


-- Create satoshis_mother user and referral entries, she is the godmother of all referrers
DO
$$
    DECLARE
        satoshis_mother_id CHAR(36);
        legacy_code        VARCHAR(20) := 'BETA_PHASE_1';
    BEGIN

        satoshis_mother_id := gen_random_uuid()::CHAR(36);

        INSERT INTO borrowers (id,
                               name,
                               email,
                               password,
                               verified)
        VALUES (satoshis_mother_id,
                'Satoshis Mother',
                'satoshis.mother@lendasat.com',
                'dummy_hashed_password_not_usable',
                true);

        -- Create referral code entry for satoshis_mother
        INSERT INTO referral_codes_borrowers (code,
                                              referrer_id,
                                              active,
                                              first_time_discount_rate_referee,
                                              first_time_commission_rate_referrer,
                                              commission_rate_referrer)
        VALUES (legacy_code,
                satoshis_mother_id,
                true,
                0, -- No discount for old beta users
                0, -- No commission for satoshis mother
                0 -- No commission for satoshis mother
               );

        -- Create used_referral_codes entries for all existing users except satoshis_mother
        INSERT INTO referred_borrowers (referral_code,
                                                   referred_borrower_id)
        SELECT legacy_code,
               id
        FROM borrowers
        WHERE id != satoshis_mother_id;

    END
$$;