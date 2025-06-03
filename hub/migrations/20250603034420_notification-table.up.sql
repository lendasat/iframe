CREATE TABLE lender_contract_update_notifications
(
    id          UUID PRIMARY KEY         NOT NULL DEFAULT gen_random_uuid(),
    contract_id CHAR(36)                 NOT NULL,
    status      contract_status          NOT NULL,
    read        boolean                  NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);

CREATE TABLE lender_contract_chat_message_notifications
(
    id          UUID PRIMARY KEY         NOT NULL DEFAULT gen_random_uuid(),
    contract_id CHAR(36)                 NOT NULL,
    read        boolean                  NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);