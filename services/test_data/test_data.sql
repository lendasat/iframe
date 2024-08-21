-- insert test users
INSERT INTO borrowers (id, name, email, password, verified, verification_code, created_at, updated_at)
SELECT '123e4567-e89b-12d3-a456-426614174000',
       'Bob the Borrower',
       'bob_the_borrower@lendasat.com',
       '$argon2id$v=19$m=19456,t=2,p=1$NIzd99/YaYEBS2EMfUaeKg$ZiuMkMcY5bPn1RjAIMQBJyHOiaH5fSRNTI1TpR7/VDc', -- `password123`
       true,
       'pDmXz0yyjW5yanNtLz6E',
       '2024-08-19 04:57:49.032793 +00:00',
       '2024-08-19 04:57:49.032793 +00:00'
WHERE NOT EXISTS (SELECT 1 FROM borrowers WHERE id = '123e4567-e89b-12d3-a456-426614174000');

INSERT INTO lenders (id, name, email, password, verified, verification_code, created_at, updated_at)
SELECT '20a7ab3c-8547-4a6b-9abe-1dc919225dfc',
       'Alice the Lender',
       'alice_the_lender@lendasat.com',
       '$argon2id$v=19$m=19456,t=2,p=1$wRXjq8x0r08PH8szqwgKdA$8/d5A7o2XQOxxCY0wHo+zRTzY6XSf4qh8kBA+PGywM4', -- `123password`
       true,
       'SsZiL7cqUPZxRUmzRmxl',
       '2024-08-19 05:00:09.115318 +00:00',
       '2024-08-19 05:00:09.115318 +00:00'
WHERE NOT EXISTS (SELECT 1 FROM lenders WHERE id = '20a7ab3c-8547-4a6b-9abe-1dc919225dfc');


-- Insert a sample loan
INSERT INTO loan_offers (id,
                         lender_id,
                         name,
                         min_ltv,
                         interest_rate,
                         loan_amount_min,
                         loan_amount_max,
                         duration_months_min,
                         duration_months_max,
                         loan_asset_type,
                         loan_asset_chain,
                         status,
                         created_at,
                         updated_at)
SELECT '456e7890-e12b-34d5-f678-901234567890',
       '20a7ab3c-8547-4a6b-9abe-1dc919225dfc',
       'Sample Loan',
       0.5,
       12.0,
       1000.00,
       100000.00,
       1,
       12,
       'Usdc',
       'Starknet',
       'Available',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1
                  FROM loan_offers
                  WHERE id = '456e7890-e12b-34d5-f678-901234567890');

--- Insert a sample contract

INSERT INTO contracts (id,
                       lender_id,
                       borrower_id,
                       loan_id,
                       initial_ltv,
                       initial_collateral_sats,
                       loan_amount,
                       status,
                       duration_months,
                       created_at,
                       updated_at)
SELECT '620744ff-3130-456b-aa38-179b4776cf0a',
       '20a7ab3c-8547-4a6b-9abe-1dc919225dfc',
       '123e4567-e89b-12d3-a456-426614174000',
       '456e7890-e12b-34d5-f678-901234567890',
       0.5,
       1000000,
       750.00,
       'Requested',
       12,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1
                  FROM contracts
                  WHERE id = '620744ff-3130-456b-aa38-179b4776cf0a');