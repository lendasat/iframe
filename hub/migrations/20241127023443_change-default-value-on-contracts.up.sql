ALTER TABLE contracts ALTER COLUMN integration SET DEFAULT 'StableCoin';
UPDATE contracts set integration = 'StableCoin' where integration IS null;
ALTER TABLE contracts ALTER COLUMN integration SET NOT NULL;
