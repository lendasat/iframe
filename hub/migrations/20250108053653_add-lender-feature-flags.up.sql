ALTER TABLE features RENAME TO borrower_features;

CREATE TABLE lender_features
(
    id          VARCHAR(100) PRIMARY KEY NOT NULL,
    name        VARCHAR(255)         NOT NULL UNIQUE,
    description TEXT,
    enabled     BOOLEAN                  DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lender_feature_flags
(
    id          SERIAL PRIMARY KEY,
    lender_id CHAR(36)     NOT NULL REFERENCES lenders (id) ON DELETE CASCADE,
    feature_id  VARCHAR(100) NOT NULL REFERENCES lender_features (id) ON DELETE CASCADE,
    is_enabled  BOOLEAN      NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (lender_id, feature_id)
);

INSERT INTO lender_features (id, name, description, enabled)
VALUES ('auto_approve', 'Auto approve loan requests', 'Automatically approve loan requests', false);
