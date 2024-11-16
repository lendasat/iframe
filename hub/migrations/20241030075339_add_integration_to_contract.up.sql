-- note: these types need to be PascalCase because of how we serialize enums.
CREATE TYPE integration AS ENUM ('PayWithMoon');

ALTER TABLE contracts ADD COLUMN integration integration;
