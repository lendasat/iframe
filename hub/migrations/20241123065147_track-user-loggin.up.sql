CREATE TABLE borrower_login_activity
(
    id          SERIAL PRIMARY KEY,
    borrower_id CHAR(36)                 NOT NULL,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers (id)
);