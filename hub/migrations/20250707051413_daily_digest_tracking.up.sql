-- Combined migration to support daily digest feature for both offers and applications
-- 1. Rename new_loan_offer_email to daily_offer_digest_email in borrower_notification_settings
-- 2. Rename new_loan_applications_email to daily_application_digest_email in lender_notification_settings
-- 3. Add daily_offer_digest_sent table to track when offer digests were sent to borrowers
-- 4. Add daily_application_digest_sent table to track when application digests were sent to lenders

-- Rename column in borrower_notification_settings
ALTER TABLE borrower_notification_settings
RENAME COLUMN new_loan_offer_email TO daily_offer_digest_email;

-- Rename column in lender_notification_settings
ALTER TABLE lender_notification_settings
RENAME COLUMN new_loan_applications_email TO daily_application_digest_email;

-- Create table to track daily offer digest sends to borrowers
CREATE TABLE daily_offer_digest_sent (
    id SERIAL PRIMARY KEY,
    borrower_id CHAR(36) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    digest_date DATE NOT NULL,
    offer_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id),
    UNIQUE(borrower_id, digest_date)
);

-- Create table to track daily application digest sends to lenders
CREATE TABLE daily_application_digest_sent (
    id SERIAL PRIMARY KEY,
    lender_id CHAR(36) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    digest_date DATE NOT NULL,
    application_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (lender_id) REFERENCES lenders (id),
    UNIQUE(lender_id, digest_date)
);

-- Create indexes for efficient queries on offer digests
CREATE INDEX idx_daily_offer_digest_sent_date ON daily_offer_digest_sent(digest_date);
CREATE INDEX idx_daily_offer_digest_sent_borrower_date ON daily_offer_digest_sent(borrower_id, digest_date);

-- Create indexes for efficient queries on application digests
CREATE INDEX idx_daily_application_digest_sent_date ON daily_application_digest_sent(digest_date);
CREATE INDEX idx_daily_application_digest_sent_lender_date ON daily_application_digest_sent(lender_id, digest_date);
