-- Add down migration script here
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS loan_offers;

DROP TYPE IF EXISTS loan_asset_type;
DROP TYPE IF EXISTS loan_asset_chain;
DROP TYPE IF EXISTS loan_offer_status;

DROP TYPE IF EXISTS contract_status;

DROP TABLE IF EXISTS "lenders";
DROP TABLE IF EXISTS "borrowers";
