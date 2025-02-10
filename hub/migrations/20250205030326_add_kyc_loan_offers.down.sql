ALTER TABLE loan_offers DROP COLUMN kyc_link;

DELETE FROM lender_features WHERE id = 'kyc_offers';

DROP TABLE IF EXISTS kyc;
