CREATE TABLE contract_extensions
(
    parent_contract_id   CHAR(36)  NOT NULL PRIMARY KEY,
    extended_contract_id CHAR(36)  NOT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_contract_id) REFERENCES contracts (id),
    FOREIGN KEY (extended_contract_id) REFERENCES contracts (id)
);
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'RenewalRequested';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'Extended';
