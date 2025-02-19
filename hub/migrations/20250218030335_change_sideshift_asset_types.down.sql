Begin;

-- Step 1: Rename columns back to their original names
ALTER TABLE sideshift_quotes
    RENAME COLUMN deposit_asset TO deposit_asset_type;
ALTER TABLE sideshift_quotes
    RENAME COLUMN settle_asset TO settle_asset_type;

ALTER TABLE sideshift_shifts
    RENAME COLUMN deposit_asset TO deposit_asset_type;
ALTER TABLE sideshift_shifts
    RENAME COLUMN settle_asset TO settle_asset_type;

-- Step 2: Add back the old columns with their original types
ALTER TABLE sideshift_quotes
    ADD COLUMN deposit_coin TEXT,
    ADD COLUMN deposit_network sideshift_network,
    ADD COLUMN settle_coin TEXT,
    ADD COLUMN settle_network sideshift_network;

ALTER TABLE sideshift_shifts
    ADD COLUMN deposit_coin TEXT,
    ADD COLUMN deposit_network sideshift_network,
    ADD COLUMN settle_coin TEXT,
    ADD COLUMN settle_network sideshift_network;

-- Step 3: Populate the old columns based on asset_type values
UPDATE sideshift_quotes
SET
    deposit_coin = CASE
                       WHEN deposit_asset_type::TEXT LIKE 'Usdt_%' THEN 'usdt'
                       WHEN deposit_asset_type::TEXT LIKE 'Usdc_%' THEN 'usdc'
                       WHEN deposit_asset_type::TEXT = 'Btc_Mainnet' THEN 'btc'
                       ELSE NULL
        END,
    deposit_network = CASE
                          WHEN deposit_asset_type::TEXT = 'Usdt_Eth' OR deposit_asset_type::TEXT = 'Usdc_Eth' THEN
            ROW('ethereum', 'mainnet'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN deposit_asset_type::TEXT = 'Usdt_Pol' OR deposit_asset_type::TEXT = 'Usdc_Pol' THEN 
            ROW('ethereum', 'polygon'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN deposit_asset_type::TEXT = 'Usdt_Sol' OR deposit_asset_type::TEXT = 'Usdc_Sol' THEN 
            ROW('solana', NULL::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, 'mainnet'::sideshift_solana_network)::sideshift_network
        WHEN deposit_asset_type::TEXT = 'Btc_Mainnet' THEN 
            ROW('bitcoin', NULL::sideshift_ethereum_network, 'bitcoin'::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        ELSE NULL
END,
    settle_coin = CASE
        WHEN settle_asset_type::TEXT LIKE 'Usdt_%' THEN 'usdt'
        WHEN settle_asset_type::TEXT LIKE 'Usdc_%' THEN 'usdc'
        WHEN settle_asset_type::TEXT = 'Btc_Mainnet' THEN 'btc'
        ELSE NULL
END,
    settle_network = CASE
        WHEN settle_asset_type::TEXT = 'Usdt_Eth' OR settle_asset_type::TEXT = 'Usdc_Eth' THEN 
            ROW('ethereum', 'mainnet'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN settle_asset_type::TEXT = 'Usdt_Pol' OR settle_asset_type::TEXT = 'Usdc_Pol' THEN 
            ROW('ethereum', 'polygon'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN settle_asset_type::TEXT = 'Usdt_Sol' OR settle_asset_type::TEXT = 'Usdc_Sol' THEN 
            ROW('solana', NULL::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, 'mainnet'::sideshift_solana_network)::sideshift_network
        WHEN settle_asset_type::TEXT = 'Btc_Mainnet' THEN 
            ROW('bitcoin', NULL::sideshift_ethereum_network, 'bitcoin'::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        ELSE NULL
END;

UPDATE sideshift_shifts
SET
    deposit_coin = CASE
                       WHEN deposit_asset_type::TEXT LIKE 'Usdt_%' THEN 'usdt'
                       WHEN deposit_asset_type::TEXT LIKE 'Usdc_%' THEN 'usdc'
                       WHEN deposit_asset_type::TEXT = 'Btc_Mainnet' THEN 'btc'
                       ELSE NULL
        END,
    deposit_network = CASE
                          WHEN deposit_asset_type::TEXT = 'Usdt_Eth' OR deposit_asset_type::TEXT = 'Usdc_Eth' THEN
            ROW('ethereum', 'mainnet'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN deposit_asset_type::TEXT = 'Usdt_Pol' OR deposit_asset_type::TEXT = 'Usdc_Pol' THEN 
            ROW('ethereum', 'polygon'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN deposit_asset_type::TEXT = 'Usdt_Sol' OR deposit_asset_type::TEXT = 'Usdc_Sol' THEN 
            ROW('solana', NULL::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, 'mainnet'::sideshift_solana_network)::sideshift_network
        WHEN deposit_asset_type::TEXT = 'Btc_Mainnet' THEN 
            ROW('bitcoin', NULL::sideshift_ethereum_network, 'bitcoin'::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        ELSE NULL
END,
    settle_coin = CASE
        WHEN settle_asset_type::TEXT LIKE 'Usdt_%' THEN 'usdt'
        WHEN settle_asset_type::TEXT LIKE 'Usdc_%' THEN 'usdc'
        WHEN settle_asset_type::TEXT = 'Btc_Mainnet' THEN 'btc'
        ELSE NULL
END,
    settle_network = CASE
        WHEN settle_asset_type::TEXT = 'Usdt_Eth' OR settle_asset_type::TEXT = 'Usdc_Eth' THEN 
            ROW('ethereum', 'mainnet'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN settle_asset_type::TEXT = 'Usdt_Pol' OR settle_asset_type::TEXT = 'Usdc_Pol' THEN 
            ROW('ethereum', 'polygon'::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        WHEN settle_asset_type::TEXT = 'Usdt_Sol' OR settle_asset_type::TEXT = 'Usdc_Sol' THEN 
            ROW('solana', NULL::sideshift_ethereum_network, NULL::sideshift_bitcoin_network, 'mainnet'::sideshift_solana_network)::sideshift_network
        WHEN settle_asset_type::TEXT = 'Btc_Mainnet' THEN 
            ROW('bitcoin', NULL::sideshift_ethereum_network, 'bitcoin'::sideshift_bitcoin_network, NULL::sideshift_solana_network)::sideshift_network
        ELSE NULL
END;

-- Step 4: Make the old columns required
ALTER TABLE sideshift_quotes
ALTER COLUMN deposit_coin SET NOT NULL,
    ALTER COLUMN deposit_network SET NOT NULL,
    ALTER COLUMN settle_coin SET NOT NULL,
    ALTER COLUMN settle_network SET NOT NULL;

ALTER TABLE sideshift_shifts
ALTER COLUMN deposit_coin SET NOT NULL,
    ALTER COLUMN deposit_network SET NOT NULL,
    ALTER COLUMN settle_coin SET NOT NULL,
    ALTER COLUMN settle_network SET NOT NULL;

-- Step 5: Drop the new columns
ALTER TABLE sideshift_quotes
    DROP COLUMN deposit_asset_type,
DROP COLUMN settle_asset_type;

ALTER TABLE sideshift_shifts
    DROP COLUMN deposit_asset_type,
DROP COLUMN settle_asset_type;

-- Step 6: Drop the new type
DROP TYPE sideshift_asset_type;

COMMIT;
