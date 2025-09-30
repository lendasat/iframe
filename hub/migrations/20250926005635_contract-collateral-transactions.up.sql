-- Add up migration script here

CREATE TABLE contract_collateral_transactions
(
    id               SERIAL PRIMARY KEY,
    tx_id            TEXT                     NOT NULL,
    amount_spent     BIGINT                   NOT NULL,
    amount_deposited BIGINT                   NOT NULL,
    block_time       TIMESTAMP WITH TIME ZONE,
    block_height     BIGINT,
    contract_id      TEXT                     NOT NULL REFERENCES contracts (id),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on contract_id for faster lookups
CREATE INDEX idx_contract_collateral_transactions_contract_id ON contract_collateral_transactions (contract_id);

-- Create index on tx_id for faster lookups
CREATE INDEX idx_contract_collateral_transactions_tx_id ON contract_collateral_transactions (tx_id);

-- Create unique constraint to prevent duplicate transactions for the same contract
ALTER TABLE contract_collateral_transactions
    ADD CONSTRAINT unique_tx_contract UNIQUE (tx_id, contract_id);

