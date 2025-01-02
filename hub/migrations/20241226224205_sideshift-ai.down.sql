DROP TABLE IF EXISTS  sideshift_shifts;
DROP TYPE IF EXISTS sideshift_shift_status;
DROP TYPE IF EXISTS sideshift_shift_kind;


DROP TABLE IF EXISTS sideshift_quotes;

DROP TYPE IF EXISTS sideshift_network;

DROP TYPE IF EXISTS sideshift_ethereum_network;
DROP TYPE IF EXISTS sideshift_bitcoin_network;
DROP TYPE IF EXISTS sideshift_coin;

DROP INDEX IF EXISTS idx_sideshift_quotes_expires_at;
