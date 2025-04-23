CREATE TYPE contract_dispute_initiator_type AS ENUM ('borrower', 'lender');
CREATE TYPE contract_dispute_status AS ENUM (
    'DisputeStartedBorrower',
    'DisputeStartedLender',
    'InProgress',
    'Closed',
    'Cancelled'
    );
CREATE TYPE contract_dispute_sender_type_enum AS ENUM ('borrower', 'lender', 'platform_admin');

-- Disputes table
CREATE TABLE contract_disputes
(
    id               UUID PRIMARY KEY,
    contract_id      char(36)                        NOT NULL REFERENCES contracts (id),
    initiator_type   contract_dispute_initiator_type NOT NULL,
    initiator_id     char(36)                        NOT NULL,
    status           contract_dispute_status         NOT NULL,
    reason           TEXT                            NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at      TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Dispute messages table
CREATE TABLE contract_dispute_messages
(
    id          UUID PRIMARY KEY,
    dispute_id  UUID                              NOT NULL REFERENCES contract_disputes (id) ON DELETE CASCADE,
    sender_type contract_dispute_sender_type_enum NOT NULL,
    sender_id   char(36)                          NOT NULL,
    message     TEXT                              NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE          NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit table for tracking dispute status changes
CREATE TABLE contract_dispute_status_audit
(
    id              SERIAL PRIMARY KEY,
    dispute_id      UUID                     NOT NULL REFERENCES contract_disputes (id) ON DELETE CASCADE,
    previous_status contract_dispute_status,
    new_status      contract_dispute_status  NOT NULL,
    changed_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE OR REPLACE FUNCTION log_dispute_status_change() RETURNS TRIGGER AS
$$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO contract_dispute_status_audit (dispute_id,
                                                   previous_status,
                                                   new_status)
        VALUES (NEW.id,
                OLD.status,
                NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_dispute_status_change
    AFTER UPDATE
    ON contract_disputes
    FOR EACH ROW
EXECUTE FUNCTION log_dispute_status_change();
