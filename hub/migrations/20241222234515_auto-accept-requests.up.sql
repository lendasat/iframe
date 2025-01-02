ALTER TABLE loan_offers
    ADD COLUMN IF NOT EXISTS auto_accept BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contract_emails
    ADD COLUMN IF NOT EXISTS loan_auto_accept_notification_sent BOOLEAN NOT NULL DEFAULT FALSE;