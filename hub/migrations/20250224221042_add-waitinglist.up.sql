-- First, create the role enum type
CREATE TYPE waitlist_role AS ENUM ('borrower', 'lender');

-- Create the waitinglist table
CREATE TABLE waitlist
(
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255)             NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role       waitlist_role            NOT NULL
);
