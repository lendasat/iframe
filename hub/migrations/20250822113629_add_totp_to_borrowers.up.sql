-- Add TOTP (Time-based One-Time Password) support to borrowers
ALTER TABLE borrowers_password_auth
    ADD COLUMN totp_secret  VARCHAR(255),
    ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;