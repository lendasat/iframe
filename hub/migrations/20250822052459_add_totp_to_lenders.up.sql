-- Add TOTP (Time-based One-Time Password) support to lenders
ALTER TABLE lenders
    ADD COLUMN totp_secret  VARCHAR(255),
    ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
