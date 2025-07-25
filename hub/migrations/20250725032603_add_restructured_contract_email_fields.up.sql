ALTER TABLE contract_emails
    ADD COLUMN restructured_contract_borrower_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contract_emails
    ADD COLUMN restructured_contract_lender_sent BOOLEAN NOT NULL DEFAULT FALSE;
