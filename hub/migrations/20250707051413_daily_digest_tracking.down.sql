-- Rollback combined migration for daily digest feature

-- Drop the daily_application_digest_sent table
DROP INDEX IF EXISTS idx_daily_application_digest_sent_lender_date;
DROP INDEX IF EXISTS idx_daily_application_digest_sent_date;
DROP TABLE IF EXISTS daily_application_digest_sent;

-- Drop the daily_offer_digest_sent table
DROP INDEX IF EXISTS idx_daily_offer_digest_sent_borrower_date;
DROP INDEX IF EXISTS idx_daily_offer_digest_sent_date;
DROP TABLE IF EXISTS daily_offer_digest_sent;

-- Rename columns back to original names
ALTER TABLE lender_notification_settings
RENAME COLUMN daily_application_digest_email TO new_loan_applications_email;

ALTER TABLE borrower_notification_settings
RENAME COLUMN daily_offer_digest_email TO new_loan_offer_email;
