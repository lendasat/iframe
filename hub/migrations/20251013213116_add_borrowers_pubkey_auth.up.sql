-- Create borrowers_pubkey_auth table for public key based authentication
CREATE TABLE borrowers_pubkey_auth (
    borrower_id TEXT PRIMARY KEY REFERENCES borrowers(id) ON DELETE CASCADE,
    pubkey TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on pubkey for faster lookups
CREATE INDEX idx_borrowers_pubkey_auth_pubkey ON borrowers_pubkey_auth(pubkey);

-- Create index on email for faster lookups
CREATE INDEX idx_borrowers_pubkey_auth_email ON borrowers_pubkey_auth(email);
