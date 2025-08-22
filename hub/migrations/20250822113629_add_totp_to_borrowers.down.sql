-- Remove TOTP support from borrowers
ALTER TABLE borrowers_password_auth
    DROP COLUMN totp_secret,
    DROP COLUMN totp_enabled;