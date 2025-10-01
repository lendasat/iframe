-- Add down migration script here

-- Drop indexes
DROP INDEX IF EXISTS idx_contract_collateral_transactions_tx_id;
DROP INDEX IF EXISTS idx_contract_collateral_transactions_contract_id;

-- Drop table
DROP TABLE IF EXISTS contract_collateral_transactions;
