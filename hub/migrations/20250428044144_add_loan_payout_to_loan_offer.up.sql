CREATE TYPE loan_payout AS ENUM ('Direct', 'Indirect');

ALTER TABLE loan_offers ADD COLUMN loan_payout loan_payout NOT NULL DEFAULT 'Direct';
