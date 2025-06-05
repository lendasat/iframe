CREATE TABLE borrower_contract_update_notifications
(
    id          UUID PRIMARY KEY         NOT NULL DEFAULT gen_random_uuid(),
    contract_id CHAR(36)                 NOT NULL,
    status      contract_status          NOT NULL,
    read        boolean                  NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);

CREATE TABLE borrower_contract_chat_message_notifications
(
    id          UUID PRIMARY KEY         NOT NULL DEFAULT gen_random_uuid(),
    contract_id CHAR(36)                 NOT NULL,
    read        boolean                  NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);

CREATE TABLE borrower_installment_update_notifications
(
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    installment_id UUID NOT NULL,
    contract_id CHAR(36) NOT NULL,
    status INSTALLMENT_STATUS NOT NULL,
    read BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT current_timestamp,
    FOREIGN KEY (contract_id) REFERENCES contracts (id),
    FOREIGN KEY (installment_id) REFERENCES installments (id)
);
