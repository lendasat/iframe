ALTER TABLE lender_notification_settings 
ADD COLUMN new_loan_applications_email BOOLEAN NOT NULL DEFAULT FALSE;
