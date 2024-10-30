CREATE TABLE features
(
    id          VARCHAR(100) PRIMARY KEY NOT NULL,
    name        VARCHAR(255)         NOT NULL UNIQUE,
    description TEXT,
    enabled     BOOLEAN                  DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE borrower_feature_flags
(
    id          SERIAL PRIMARY KEY,
    borrower_id CHAR(36)     NOT NULL REFERENCES borrowers (id) ON DELETE CASCADE,
    feature_id  VARCHAR(100) NOT NULL REFERENCES features (id) ON DELETE CASCADE,
    is_enabled  BOOLEAN      NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (borrower_id, feature_id)
);

INSERT INTO features (id, name, description, enabled)
VALUES ('stable_coins', 'Stable Coins', 'Receive the loan as stable coins', true);

INSERT INTO features (id, name, description, enabled)
VALUES ('pay_with_moon', 'PayWithMoon DebitCard', 'Receive the loan as a rechargable debit card', false);

