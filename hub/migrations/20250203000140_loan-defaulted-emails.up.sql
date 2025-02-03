ALTER TABLE contract_emails
    ADD COLUMN defaulted_loan_borrower_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contract_emails
    ADD COLUMN defaulted_loan_lender_sent BOOLEAN NOT NULL DEFAULT FALSE;
