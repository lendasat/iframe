ALTER TABLE moon_cards drop column expiration;
ALTER TABLE moon_cards add column expiration TIMESTAMP WITH TIME ZONE NOT NULL default NOW();
