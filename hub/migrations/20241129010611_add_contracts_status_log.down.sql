DROP TRIGGER IF EXISTS track_status_change ON contracts;
DROP FUNCTION IF EXISTS log_status_change();
DROP TABLE IF EXISTS contracts_status_log;
