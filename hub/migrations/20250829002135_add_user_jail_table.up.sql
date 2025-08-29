-- Create borrower jail table
CREATE TABLE borrower_jail (
    id SERIAL PRIMARY KEY NOT NULL,
    borrower_id CHAR(36) NOT NULL REFERENCES borrowers(id),
    reason TEXT,
    jailed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(borrower_id)
);

-- Create lender jail table
CREATE TABLE lender_jail (
    id SERIAL PRIMARY KEY NOT NULL,
    lender_id CHAR(36) NOT NULL REFERENCES lenders(id),
    reason TEXT,
    jailed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lender_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_borrower_jail_lookup ON borrower_jail(borrower_id);
CREATE INDEX idx_lender_jail_lookup ON lender_jail(lender_id);

-- Add comments explaining the tables
COMMENT ON TABLE borrower_jail IS 'Tracks borrowers who are restricted from viewing loan offers or creating loan applications';
COMMENT ON TABLE lender_jail IS 'Tracks lenders who are restricted from viewing loan applications or creating loan offers';