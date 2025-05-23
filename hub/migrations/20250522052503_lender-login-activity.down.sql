drop table if exists lender_login_activity;
ALTER TABLE borrower_login_activity
    DROP COLUMN IF EXISTS
        country;
ALTER TABLE borrower_login_activity
    DROP COLUMN IF EXISTS
        city;
