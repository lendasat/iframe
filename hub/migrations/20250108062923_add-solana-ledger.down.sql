DROP TABLE IF EXISTS sideshift_shifts;
DROP TABLE IF EXISTS sideshift_quotes;

-- Drop the updated type
DROP TYPE sideshift_network;

-- Recreate the original network type without Solana
CREATE TYPE sideshift_network AS (
    network_type TEXT, -- 'ethereum' or 'bitcoin'
    ethereum_network sideshift_ethereum_network,
    bitcoin_network sideshift_bitcoin_network
);

-- Recreate the original quotes table
CREATE TABLE sideshift_quotes
(
    id              UUID PRIMARY KEY,
    contract_id     CHAR(36)                 NOT NULL,
    deposit_coin    sideshift_coin           NOT NULL,
    deposit_network sideshift_network        NOT NULL,
    settle_coin     sideshift_coin           NOT NULL,
    settle_network  sideshift_network        NOT NULL,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    deposit_amount  DECIMAL                  NOT NULL,
    settle_amount   DECIMAL                  NOT NULL,
    rate            DECIMAL                  NOT NULL,
    affiliate_id    TEXT                     NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id),

    -- Original constraints without Solana
    CONSTRAINT valid_deposit_network CHECK (
            ((deposit_network).network_type = 'ethereum' AND
                (deposit_network).ethereum_network IS NOT NULL AND
                (deposit_network).bitcoin_network IS NULL) OR
            ((deposit_network).network_type = 'bitcoin' AND
                (deposit_network).bitcoin_network IS NOT NULL AND
                (deposit_network).ethereum_network IS NULL)
        ),
    CONSTRAINT valid_settle_network CHECK (
            ((settle_network).network_type = 'ethereum' AND
                (settle_network).ethereum_network IS NOT NULL AND
                (settle_network).bitcoin_network IS NULL) OR
            ((settle_network).network_type = 'bitcoin' AND
                (settle_network).bitcoin_network IS NOT NULL AND
                (settle_network).ethereum_network IS NULL)
        )
);

-- Recreate the original index
CREATE INDEX idx_sideshift_quotes_expires_at ON sideshift_quotes (expires_at);

-- Recreate the original shifts table
CREATE TABLE sideshift_shifts
(
    id                      TEXT PRIMARY KEY,
    quote_id                UUID                     NOT NULL,
    kind                    sideshift_shift_kind     NOT NULL,
    deposit_amount          DECIMAL                  NOT NULL,
    settle_amount           DECIMAL                  NOT NULL,
    deposit_coin            sideshift_coin           NOT NULL,
    deposit_network         sideshift_network        NOT NULL,
    settle_coin            sideshift_coin           NOT NULL,
    settle_network         sideshift_network        NOT NULL,
    deposit_address         TEXT                     NOT NULL,
    settle_address          TEXT                     NOT NULL,
    external_id             TEXT                     NOT NULL,
    rate                    DECIMAL                  NOT NULL,
    status                  sideshift_shift_status   NOT NULL,
    average_shift_seconds   DECIMAL                  NOT NULL,
    deposit_hash            TEXT,
    settle_hash             TEXT,
    deposit_received_at     TIMESTAMP WITH TIME ZONE,
    settle_coin_network_fee DECIMAL,
    issue                   TEXT,
    expires_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES sideshift_quotes (id)
);

-- Finally, drop the Solana network enum type
DROP TYPE sideshift_solana_network;
