CREATE TYPE repayment_plan AS ENUM (
    'Bullet', 'InterestOnlyWeekly', 'InterestOnlyMonthly'
);

ALTER TABLE loan_offers ADD COLUMN repayment_plan repayment_plan NOT NULL DEFAULT 'Bullet';
ALTER TABLE loan_applications ADD COLUMN repayment_plan repayment_plan NOT NULL DEFAULT 'Bullet';

CREATE TYPE installment_status AS ENUM ('Pending', 'Paid', 'Confirmed', 'Late', 'Cancelled');

CREATE TABLE installments
(
    id UUID PRIMARY KEY NOT NULL default gen_random_uuid(),
    contract_id char(36) NOT NULL,
    principal decimal NOT NULL,
    interest decimal NOT NULL,
    due_date TIMESTAMP with TIME ZONE NOT NULL,
    status installment_status NOT NULL DEFAULT 'Pending',
    payment_id TEXT,
    paid_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts (id)
);

-- Generate a balloon installment for every open contract. We do not attempt to reference the
-- transaction ID in the `payment_id` column of `Paid` or `Confirmed` contracts to keep this query
-- simpler. This field is only informational and we can always fix this later if we want to.
INSERT INTO installments (contract_id, principal, interest, due_date, status)
SELECT
    id AS contract_id,
    loan_amount AS principal,
    interest,
    expiry_date AS due_date,
    CASE
        WHEN status = 'RepaymentProvided' THEN 'Paid'::installment_status
        WHEN status IN ('RepaymentConfirmed', 'Closing', 'Closed') THEN 'Confirmed'::installment_status
        WHEN status = 'Defaulted' THEN 'Late'::installment_status
        ELSE 'Pending'::installment_status
    END AS status
FROM
    contracts
WHERE status NOT IN ('Cancelled', 'RequestExpired', 'ApprovalExpired', 'Rejected', 'Extended');

ALTER TYPE transaction_type RENAME VALUE 'PrincipalRepaid' TO 'InstallmentPaid';

-- Drop `contracts`-related views to reintroduce them later.

DROP VIEW IF EXISTS borrower_discount_info;
DROP VIEW IF EXISTS inactive_contracts;
DROP VIEW IF EXISTS closed_contracts;
DROP VIEW IF EXISTS open_contracts;
DROP VIEW IF EXISTS expired_open_contracts;
DROP VIEW IF EXISTS contracts_to_be_watched;

ALTER TABLE contracts DROP COLUMN interest;

-- Re-introduce views related to `contracts` table.

CREATE VIEW inactive_contracts AS
SELECT *
FROM contracts
WHERE status IN ('Rejected', 'Cancelled', 'RequestExpired');

CREATE VIEW closed_contracts AS
SELECT *
FROM contracts
WHERE status IN ('Closed', 'Extended');

CREATE VIEW open_contracts AS
SELECT *
FROM contracts
WHERE
    status IN
    (
        'CollateralSeen',
        'CollateralConfirmed',
        'PrincipalGiven',
        'RepaymentProvided',
        'RepaymentConfirmed',
        'Closing',
        'DisputeBorrowerStarted',
        'DisputeLenderStarted',
        'DisputeBorrowerResolved',
        'DisputeLenderResolved',
        'Defaulted',
        'Undercollateralized',
        'RenewalRequested'
    );

CREATE VIEW expired_open_contracts AS
SELECT *
FROM contracts
WHERE
    expiry_date <= Now()
    AND status IN
    (
        'CollateralSeen',
        'CollateralConfirmed',
        'PrincipalGiven',
        'RenewalRequested',
        'DisputeBorrowerStarted',
        'DisputeLenderStarted',
        'DisputeBorrowerResolved',
        'DisputeLenderResolved',
        'Defaulted',
        'Undercollateralized'
    );


CREATE VIEW borrower_discount_info AS
SELECT
    b.*,
    personal_referral_info.code AS personal_referral_code,
    was_referred.referral_code AS used_referral_code,
    CASE
        WHEN (
            SELECT COUNT(*)
            FROM contracts
            WHERE
                borrower_id = b.id
                AND id NOT IN (SELECT id FROM inactive_contracts)
        ) > 0 THEN 0
        ELSE was_referred_rate.first_time_discount_rate_referee
    END AS first_time_discount_rate_referee
FROM borrowers b
LEFT JOIN
    referral_codes_borrowers personal_referral_info
    ON personal_referral_info.referrer_id = b.id
LEFT JOIN
    referred_borrowers was_referred
    ON was_referred.referred_borrower_id = b.id
LEFT JOIN
    referral_codes_borrowers was_referred_rate
    ON was_referred_rate.code = was_referred.referral_code;

CREATE VIEW contracts_to_be_watched AS
SELECT *
FROM contracts
WHERE
    status IN
    (
        'Approved',
        'CollateralSeen',
        'CollateralConfirmed',
        'PrincipalGiven',
        'RepaymentProvided',
        'RepaymentConfirmed',
        'Closing',
        'DisputeBorrowerStarted',
        'DisputeLenderStarted',
        'DisputeBorrowerResolved',
        'DisputeLenderResolved',
        'Defaulted',
        'Undercollateralized',
        'RenewalRequested'
    );
