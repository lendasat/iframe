CREATE TABLE init_table
(
    id    SERIAL PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO init_table (value) VALUES ('Initial value');
