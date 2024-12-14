-- Add down migration script here
ALTER TABLE contract_emails DROP COLUMN loan_repaid_sent;
