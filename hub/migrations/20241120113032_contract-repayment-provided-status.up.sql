-- Step 1: Create a new ENUM type with the updated values
CREATE TYPE contract_status_new AS ENUM (
    'Requested',
    'Approved',
    'CollateralSeen',
    'CollateralConfirmed',
    'PrincipalGiven',
    'RepaymentProvided',
    'RepaymentConfirmed',
    'Closing',
    'Closed',
    'Rejected',
    'DisputeBorrowerStarted',
    'DisputeLenderStarted',
    'DisputeBorrowerResolved',
    'DisputeLenderResolved'
    );

-- Step 2: Update all columns that use the old ENUM type
-- Assume the column is `status` in a table `contracts`
ALTER TABLE contracts
    ALTER COLUMN status TYPE contract_status_new
        USING status::TEXT::contract_status_new;

-- Step 3: Drop the old ENUM type
DROP TYPE contract_status;

-- Step 4: Rename the new ENUM type to the original name
ALTER TYPE contract_status_new RENAME TO contract_status;
