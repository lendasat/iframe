ALTER TABLE loan_offers
    DROP COLUMN IF EXISTS auto_accept;
ALTER TABLE contract_emails
    DROP COLUMN IF EXISTS loan_auto_accept_notification_sent;