-- Step 1: Recreate the original ENUM type
CREATE TYPE contract_status_old AS ENUM (
    'Requested',
    'Approved',
    'CollateralSeen',
    'CollateralConfirmed',
    'PrincipalGiven',
    'Repaid',
    'Closing',
    'Closed',
    'Rejected',
    'DisputeBorrowerStarted',
    'DisputeLenderStarted',
    'DisputeBorrowerResolved',
    'DisputeLenderResolved'
    );

-- Step 2: Update all columns back to use the old ENUM type
-- Assume the column is `status` in a table `contracts`
ALTER TABLE contracts
    ALTER COLUMN status TYPE contract_status_old
        USING status::TEXT::contract_status_old;

-- Step 3: Drop the new ENUM type
DROP TYPE contract_status;

-- Step 4: Rename the old ENUM type back to the original name
ALTER TYPE contract_status_old RENAME TO contract_status;
