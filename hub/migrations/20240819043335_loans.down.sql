-- Add down migration script here

DROP TABLE IF EXISTS loan_offers;
DROP TYPE IF EXISTS loan_asset_type;
DROP TYPE IF EXISTS loan_asset_chain;
DROP TYPE IF EXISTS loan_status;
