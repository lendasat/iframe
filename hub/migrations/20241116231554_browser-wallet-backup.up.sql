CREATE TABLE borrower_wallet_backups
(
    id                  SERIAL PRIMARY KEY,
    borrower_id         CHAR(36) UNIQUE          NOT NULL,
    passphrase_hash     TEXT                     NOT NULL,
    mnemonic_ciphertext TEXT                     NOT NULL,
    network             VARCHAR(50)              NOT NULL,
    xpub                TEXT                     NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);

CREATE TABLE lender_wallet_backups
(
    id                  SERIAL PRIMARY KEY,
    lender_id           CHAR(36) UNIQUE          NOT NULL,
    passphrase_hash     TEXT                     NOT NULL,
    mnemonic_ciphertext TEXT                     NOT NULL,
    network             VARCHAR(50)              NOT NULL,
    xpub                TEXT                     NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lender_id) REFERENCES lenders (id)
);
