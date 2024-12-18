CREATE TABLE manual_collateral_recovery
(
    id                 SERIAL PRIMARY KEY,
    contract_id        CHAR(36)                 NOT NULL UNIQUE,
    -- We only need to specify the lender amount because the borrower
    -- amount is implicit i.e. total - lender - origination_fee.
    lender_amount_sats BIGINT                   NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);
