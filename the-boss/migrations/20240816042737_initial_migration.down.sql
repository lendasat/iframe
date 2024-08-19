-- Add down migration script here

DROP TABLE IF EXISTS users;

DROP INDEX IF EXISTS idx_verification_code;
DROP INDEX IF EXISTS idx_password_reset_token;
DROP INDEX IF EXISTS idx_password_reset_at;
