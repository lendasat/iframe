ALTER TABLE contract_emails
    DROP COLUMN IF EXISTS defaulted_loan_borrower_sent;
ALTER TABLE contract_emails
    DROP COLUMN IF EXISTS defaulted_loan_lender_sent;
