ALTER TABLE contract_emails
    ADD COLUMN loan_request_expired_borrower_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contract_emails
    ADD COLUMN loan_request_expired_lender_sent BOOLEAN NOT NULL DEFAULT FALSE;
