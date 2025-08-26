-- Remove TOTP support from lenders
ALTER TABLE lenders
    DROP COLUMN totp_secret,
    DROP COLUMN totp_enabled;
