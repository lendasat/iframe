Begin;

-- Step 1: Create the new sideshift_asset_type ENUM
CREATE TYPE sideshift_asset_type AS ENUM (
    'UsdtEth',
    'UsdcEth',
    'UsdtPol',
    'UsdcPol',
    'UsdtStrk',
    'UsdcStrk',
    'UsdtSol',
    'UsdcSol',
    'UsdtLiquid',
    'BtcMainnet'
    );


-- Step 2: Add new columns to existing tables
ALTER TABLE sideshift_quotes
    ADD COLUMN deposit_asset_type sideshift_asset_type,
    ADD COLUMN settle_asset_type  sideshift_asset_type;

ALTER TABLE sideshift_shifts
    ADD COLUMN deposit_asset_type sideshift_asset_type,
    ADD COLUMN settle_asset_type  sideshift_asset_type;


-- Step 3: Update the new columns in quotes table
UPDATE sideshift_quotes
SET deposit_asset_type = CASE
    -- Ethereum network variations
                             WHEN (deposit_network).network_type = 'ethereum' AND
                                  (deposit_network).ethereum_network = 'mainnet' AND deposit_coin = 'usdt'
                                 THEN 'UsdtEth'::sideshift_asset_type
                             WHEN (deposit_network).network_type = 'ethereum' AND
                                  (deposit_network).ethereum_network = 'mainnet' AND deposit_coin = 'usdc'
                                 THEN 'UsdcEth'::sideshift_asset_type

                             WHEN (deposit_network).network_type = 'ethereum' AND
                                  (deposit_network).ethereum_network = 'polygon' AND deposit_coin = 'usdt'
                                 THEN 'UsdtPol'::sideshift_asset_type
                             WHEN (deposit_network).network_type = 'ethereum' AND
                                  (deposit_network).ethereum_network = 'polygon' AND deposit_coin = 'usdc'
                                 THEN 'UsdcPol'::sideshift_asset_type

    -- Solana network
                             WHEN (deposit_network).network_type = 'solana' AND
                                  (deposit_network).solana_network = 'mainnet' AND deposit_coin = 'usdt' THEN 'UsdtSol'::sideshift_asset_type
                             WHEN (deposit_network).network_type = 'solana' AND
                                  (deposit_network).solana_network = 'mainnet' AND deposit_coin = 'usdc' THEN 'UsdcSol'::sideshift_asset_type

    -- Bitcoin network
                             WHEN (deposit_network).network_type = 'bitcoin' AND
                                  (deposit_network).bitcoin_network = 'bitcoin' THEN 'BtcMainnet'::sideshift_asset_type

                             ELSE NULL
    END,
    settle_asset_type  = CASE
        -- Ethereum network variations
                             WHEN (settle_network).network_type = 'ethereum' AND
                                  (settle_network).ethereum_network = 'mainnet' AND settle_coin = 'usdt' THEN 'UsdtEth'::sideshift_asset_type
                             WHEN (settle_network).network_type = 'ethereum' AND
                                  (settle_network).ethereum_network = 'mainnet' AND settle_coin = 'usdc' THEN 'UsdcEth'::sideshift_asset_type

                             WHEN (settle_network).network_type = 'ethereum' AND
                                  (settle_network).ethereum_network = 'polygon' AND settle_coin = 'usdt' THEN 'UsdtPol'::sideshift_asset_type
                             WHEN (settle_network).network_type = 'ethereum' AND
                                  (settle_network).ethereum_network = 'polygon' AND settle_coin = 'usdc' THEN 'UsdcPol'::sideshift_asset_type

        -- Solana network
                             WHEN (settle_network).network_type = 'solana' AND
                                  (settle_network).solana_network = 'mainnet' AND settle_coin = 'usdt' THEN 'UsdtSol'::sideshift_asset_type
                             WHEN (settle_network).network_type = 'solana' AND
                                  (settle_network).solana_network = 'mainnet' AND settle_coin = 'usdc' THEN 'UsdcSol'::sideshift_asset_type

        -- Bitcoin network
                             WHEN (settle_network).network_type = 'bitcoin' AND
                                  (settle_network).bitcoin_network = 'bitcoin' THEN 'BtcMainnet'::sideshift_asset_type

                             ELSE NULL
        END;


-- Step 4: Make the new columns required
ALTER TABLE sideshift_quotes
    ALTER COLUMN deposit_asset_type SET NOT NULL,
    ALTER COLUMN settle_asset_type SET NOT NULL;

ALTER TABLE sideshift_shifts
    ALTER COLUMN deposit_asset_type SET NOT NULL,
    ALTER COLUMN settle_asset_type SET NOT NULL;

-- Step 5: Drop the old columns
ALTER TABLE sideshift_quotes
    DROP COLUMN deposit_coin,
    DROP COLUMN deposit_network,
    DROP COLUMN settle_coin,
    DROP COLUMN settle_network;

ALTER TABLE sideshift_shifts
    DROP COLUMN deposit_coin,
    DROP COLUMN deposit_network,
    DROP COLUMN settle_coin,
    DROP COLUMN settle_network;

-- Step 6: Rename the new columns to their final names
ALTER TABLE sideshift_quotes
    RENAME COLUMN deposit_asset_type TO deposit_asset;
ALTER TABLE sideshift_quotes
    RENAME COLUMN settle_asset_type TO settle_asset;

ALTER TABLE sideshift_shifts
    RENAME COLUMN deposit_asset_type TO deposit_asset;
ALTER TABLE sideshift_shifts
    RENAME COLUMN settle_asset_type TO settle_asset;

COMMIT;
