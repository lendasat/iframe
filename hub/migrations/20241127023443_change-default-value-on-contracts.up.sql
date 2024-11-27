ALTER TABLE contracts ALTER COLUMN integration SET NOT NULL;
ALTER TABLE contracts ALTER COLUMN integration SET DEFAULT 'StableCoin';
