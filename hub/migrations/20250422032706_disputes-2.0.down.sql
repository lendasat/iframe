DROP TRIGGER IF EXISTS audit_contract_dispute_creation ON contract_disputes;
DROP TRIGGER IF EXISTS audit_contract_dispute_status ON contract_disputes;
DROP TRIGGER IF EXISTS enforce_contract_dispute_resolution_status ON contract_disputes;
DROP TRIGGER IF EXISTS update_contract_dispute_timestamp ON contract_disputes;

-- Then drop the functions
DROP FUNCTION IF EXISTS audit_contract_dispute_creation();
DROP FUNCTION IF EXISTS audit_contract_dispute_status_change();
DROP FUNCTION IF EXISTS update_contract_dispute_status_on_resolution();
DROP FUNCTION IF EXISTS update_contract_dispute_timestamp();

-- Now drop the tables (in reverse order of creation/dependency)
DROP TABLE IF EXISTS contract_dispute_status_audit;
DROP TABLE IF EXISTS contract_dispute_messages;
DROP TABLE IF EXISTS contract_disputes;

-- Finally drop the custom enum types
DROP TYPE IF EXISTS contract_dispute_sender_type_enum;
DROP TYPE IF EXISTS contract_dispute_status;
DROP TYPE IF EXISTS contract_dispute_initiator_type;
