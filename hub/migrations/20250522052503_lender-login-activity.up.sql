CREATE TABLE lender_login_activity
(
    id         SERIAL PRIMARY KEY,
    lender_id  CHAR(36)                 NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    country    TEXT,
    city       TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES lenders (id)
);

ALTER TABLE borrower_login_activity
    ADD COLUMN
        country TEXT;
ALTER TABLE borrower_login_activity
    ADD COLUMN
        city TEXT;
