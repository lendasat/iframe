ALTER TYPE integration ADD VALUE IF NOT EXISTS 'StableCoin';

ALTER TABLE contracts
    ALTER COLUMN integration SET NOT NULL,
    ALTER COLUMN integration SET DEFAULT 'StableCoin';