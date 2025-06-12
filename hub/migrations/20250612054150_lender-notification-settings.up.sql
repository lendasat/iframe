CREATE TABLE lender_notification_settings
(
    id                               SERIAL PRIMARY KEY,
    lender_id                        CHAR(36)                 NOT NULL REFERENCES lenders (id),
    on_login_email                   BOOLEAN                  NOT NULL DEFAULT TRUE,
    on_login_telegram                BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_loan_applications_email      BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_loan_applications_telegram   BOOLEAN                  NOT NULL DEFAULT TRUE,
    contract_status_changed_email    BOOLEAN                  NOT NULL DEFAULT TRUE,
    contract_status_changed_telegram BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_chat_message_email           BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_chat_message_telegram        BOOLEAN                  NOT NULL DEFAULT TRUE,
    created_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (lender_id)
);

CREATE TABLE borrower_notification_settings
(
    id                               SERIAL PRIMARY KEY,
    borrower_id                      CHAR(36)                 NOT NULL REFERENCES borrowers (id),
    on_login_email                   BOOLEAN                  NOT NULL DEFAULT TRUE,
    on_login_telegram                BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_loan_offer_email             BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_loan_offer_telegram          BOOLEAN                  NOT NULL DEFAULT TRUE,
    contract_status_changed_email    BOOLEAN                  NOT NULL DEFAULT TRUE,
    contract_status_changed_telegram BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_chat_message_email           BOOLEAN                  NOT NULL DEFAULT TRUE,
    new_chat_message_telegram        BOOLEAN                  NOT NULL DEFAULT TRUE,
    created_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (borrower_id)
);