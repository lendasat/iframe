
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'Defaulted';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'ClosedByLiquidation';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'ClosedByDefaulting';
