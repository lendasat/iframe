ALTER TABLE moon_cards drop column expiration;
ALTER TABLE moon_cards add column expiration varchar(10) not null default '01/1970';
