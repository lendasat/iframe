-- Add up migration script here
ALTER TABLE contract_emails ADD COLUMN loan_repaid_sent BOOLEAN NOT NULL DEFAULT FALSE;
