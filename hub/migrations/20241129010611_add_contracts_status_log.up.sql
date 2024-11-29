CREATE TABLE contracts_status_log
(
    id          SERIAL PRIMARY KEY       NOT NULL,
    contract_id CHAR(36)                 NOT NULL,
    old_status  contract_status          NOT NULL,
    new_status  contract_status          NOT NULL,
    changed_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);

CREATE OR REPLACE FUNCTION log_status_change() RETURNS TRIGGER AS $$
   BEGIN
       IF NEW.status IS DISTINCT FROM OLD.status THEN
           INSERT INTO contracts_status_log (contract_id, old_status, new_status, changed_at)
           VALUES (OLD.id, OLD.status, NEW.status, CURRENT_TIMESTAMP);
       END IF;
       RETURN NEW;
   END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_status_change
AFTER UPDATE ON contracts
FOR EACH ROW
EXECUTE FUNCTION log_status_change();
