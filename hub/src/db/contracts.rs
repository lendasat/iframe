use crate::db::contract_emails;
use crate::expiry::expiry_date;
use crate::model::db;
use crate::model::Contract;
use crate::model::ContractStatus;
use crate::model::ContractVersion;
use crate::model::Integration;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32::Xpub;
use bitcoin::Address;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use std::cmp::Ordering;
use time::format_description;
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn load_contracts_by_borrower_id(
    pool: &Pool<Postgres>,
    id: &str,
) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        FROM contracts
        where borrower_id = $1
        "#,
        id
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contracts_by_lender_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        FROM contracts
        where lender_id = $1
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

async fn load_contract(pool: &Pool<Postgres>, contract_id: &str) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        FROM contracts
        where id = $1
        "#,
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn load_contract_by_contract_id_and_borrower_id(
    pool: &Pool<Postgres>,
    contract_id: &str,
    borrower_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        FROM contracts
        where id = $1 AND
        borrower_id = $2
        "#,
        contract_id,
        borrower_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn load_contract_by_contract_id_and_lender_id(
    pool: &Pool<Postgres>,
    contract_id: &str,
    lender_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        FROM contracts
        where id = $1 AND
        lender_id = $2
        "#,
        contract_id,
        lender_id
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn load_open_contracts(pool: &Pool<Postgres>) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        FROM contracts
        WHERE status NOT IN ($1, $2, $3, $4, $5)
        "#,
        db::ContractStatus::Requested as db::ContractStatus,
        db::ContractStatus::Closed as db::ContractStatus,
        db::ContractStatus::Rejected as db::ContractStatus,
        db::ContractStatus::Cancelled as db::ContractStatus,
        db::ContractStatus::RequestExpired as db::ContractStatus,
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_contract_request(
    pool: &Pool<Postgres>,
    id: Uuid,
    borrower_id: &str,
    lender_id: &str,
    loan_id: &str,
    initial_ltv: Decimal,
    initial_collateral_sats: u64,
    origination_fee_sats: u64,
    loan_amount: Decimal,
    duration_months: i32,
    borrower_btc_address: Address<NetworkUnchecked>,
    borrower_pk: PublicKey,
    borrower_loan_address: &str,
    integration: Integration,
    contract_version: ContractVersion,
    auto_accepted: bool,
) -> Result<Contract> {
    let mut db_tx = pool
        .begin()
        .await
        .context("Failed to start db transaction")?;

    let id = id.to_string();
    let initial_collateral_sats = initial_collateral_sats as i64;
    let origination_fee_sats = origination_fee_sats as i64;
    let collateral_sats = 0;
    let integration = db::Integration::from(integration);
    let contract_version = contract_version as i32;

    let created_at = OffsetDateTime::now_utc();
    let expiry_date = expiry_date(created_at, duration_months as u64);

    let status = if auto_accepted {
        db::ContractStatus::Approved
    } else {
        db::ContractStatus::Requested
    };

    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        INSERT INTO contracts (
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            duration_months,
            status,
            liquidation_status,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration,
            contract_address,
            contract_index,
            contract_version,
            created_at,
            expiry_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        "#,
        id.as_str(),
        lender_id,
        borrower_id,
        loan_id,
        initial_ltv,
        initial_collateral_sats,
        origination_fee_sats,
        collateral_sats,
        loan_amount,
        duration_months,
        status as db::ContractStatus,
        db::LiquidationStatus::Healthy as db::LiquidationStatus,
        borrower_btc_address.assume_checked().to_string(),
        borrower_pk.to_string(),
        borrower_loan_address,
        integration as db::Integration,
        None as Option<String>,
        None as Option<i32>,
        contract_version,
        created_at,
        expiry_date
    )
    .fetch_one(&mut *db_tx)
        .await?;

    contract_emails::start_tracking_contract_emails(&mut *db_tx, &id).await?;

    db_tx.commit().await?;

    Ok(contract.into())
}

pub async fn accept_contract_request(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    lender_id: &str,
    contract_id: &str,
    contract_address: Address,
    contract_index: u32,
    lender_xpub: Xpub,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET status = $1,
            updated_at = $2,
            contract_address = $3,
            contract_index = $4,
            lender_xpub = $5
        WHERE lender_id = $6
          AND id = $7
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Approved as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_address.to_string(),
        contract_index as i32,
        lender_xpub.to_string(),
        lender_id,
        contract_id
    )
    .fetch_one(&mut **transaction)
    .await?;

    Ok(contract.into())
}

pub async fn mark_contract_as_principal_given(
    pool: &Pool<Postgres>,
    contract_id: &str,
    duration_months: i32,
) -> Result<Contract> {
    let updated_at = OffsetDateTime::now_utc();

    // We update the expiry to ensure that the loan lasts long enough. We could be even more precise
    // if we checked the confirmation time of the principal transaction, but this is probably good
    // enough.
    let expiry_date = expiry_date(updated_at, duration_months as u64);

    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            status = $1,
            expiry_date = $2,
            updated_at = $3
        WHERE id = $4
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::PrincipalGiven as db::ContractStatus,
        expiry_date,
        updated_at,
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn mark_contract_as_repayment_provided(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::RepaymentProvided).await
}

pub async fn mark_contract_as_repayment_confirmed(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::RepaymentConfirmed).await
}

pub async fn mark_contract_as_cancelled(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Cancelled).await
}

pub async fn mark_contract_as_closed(pool: &Pool<Postgres>, contract_id: &str) -> Result<Contract> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Closed).await
}

pub async fn mark_contract_as_closing(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Closing).await
}

pub async fn mark_contract_as_undercollateralized(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Undercollateralized).await
}

pub async fn reject_contract_request(
    pool: &Pool<Postgres>,
    lender_id: &str,
    contract_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET status = $1,
            updated_at = $2
        WHERE lender_id = $3
          AND id = $4
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Rejected as db::ContractStatus,
        OffsetDateTime::now_utc(),
        lender_id,
        contract_id
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub(crate) async fn mark_liquidation_state_as(
    pool: &Pool<Postgres>,
    contract_id: &str,
    status: db::LiquidationStatus,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            liquidation_status = $1,
            updated_at = $2
        WHERE id = $3
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        "#,
        status as db::LiquidationStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub(crate) async fn mark_contract_state_as<'a, E>(
    pool: E,
    contract_id: &str,
    status: db::ContractStatus,
) -> Result<Contract>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            status = $1,
            updated_at = $2
        WHERE id = $3
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        "#,
        status as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub(crate) async fn load_open_not_liquidated_contracts(
    pool: &Pool<Postgres>,
) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        FROM contracts
        WHERE status NOT IN ($1, $2, $3, $4, $5, $6, $7, $8, $9) and liquidation_status NOT in ($10)
        "#,
        db::ContractStatus::Requested as db::ContractStatus,
        db::ContractStatus::Approved as db::ContractStatus,
        db::ContractStatus::Closing as db::ContractStatus,
        db::ContractStatus::Closed as db::ContractStatus,
        db::ContractStatus::Rejected as db::ContractStatus,
        db::ContractStatus::Cancelled as db::ContractStatus,
        db::ContractStatus::RequestExpired as db::ContractStatus,
        db::ContractStatus::Defaulted as db::ContractStatus,
        db::ContractStatus::Undercollateralized as db::ContractStatus,
        db::LiquidationStatus::Liquidated as db::LiquidationStatus,
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

/// Marks expired active contracts (the principal was disbursed, but the loan was not repaid) as
/// `Defaulted`.
pub(crate) async fn default_expired_contracts(pool: &Pool<Postgres>) -> Result<Vec<String>> {
    // TODO: We should "start the timer" from the time the principal is disbursed, not from the time
    // the contract is created in the database.
    let rows = sqlx::query!(
        r#"
            UPDATE
                contracts
            SET
                status = $1, updated_at = $2
            WHERE
                expiry_date <= $2 AND
                status NOT IN ($3, $4, $5, $6, $7, $8, $9, $1)
            RETURNING id;
        "#,
        db::ContractStatus::Defaulted as db::ContractStatus,
        OffsetDateTime::now_utc(),
        db::ContractStatus::Requested as db::ContractStatus,
        db::ContractStatus::Approved as db::ContractStatus,
        db::ContractStatus::Closing as db::ContractStatus,
        db::ContractStatus::Closed as db::ContractStatus,
        db::ContractStatus::Rejected as db::ContractStatus,
        db::ContractStatus::Cancelled as db::ContractStatus,
        db::ContractStatus::RequestExpired as db::ContractStatus,
    )
    .fetch_all(pool)
    .await?;

    let contract_ids = rows.into_iter().map(|row| row.id).collect();

    Ok(contract_ids)
}

/// Update the collateral of the [`Contract`] in the database.
///
/// The `collateral_sats` and `status` columns are only updated if something actually changes based
/// on the reported `updated_collateral_sats` argument.
///
/// # Returns
///
/// A tuple with the updated [`Contract`] and a boolean indicating if the contract's collateral was
/// just confirmed.
///
/// This function is the cost we have to pay for not modelling things properly.
pub async fn update_collateral(
    pool: &Pool<Postgres>,
    contract_id: &str,
    updated_collateral_sats: u64,
) -> Result<(Contract, bool)> {
    let contract = load_contract(pool, contract_id).await?;

    let min_collateral = contract.initial_collateral_sats;
    let current_collateral_sats = contract.collateral_sats;

    // The status does not always change, but it's simpler to always write to the database if the
    // collateral changes.
    let (new_status, is_newly_confirmed) =
        match updated_collateral_sats.cmp(&current_collateral_sats) {
            Ordering::Greater => {
                tracing::debug!(
                    contract_id,
                    before = current_collateral_sats,
                    after = updated_collateral_sats,
                    "Collateral increased"
                );

                match contract.status {
                    ContractStatus::Requested => {
                        // This means that a contract's newly assigned address already has money in
                        // it. We can only get here if the _contract address_ was reused, which is a
                        // really bad idea.
                        bail!("Should not be able to add collateral to a Requested loan");
                    }
                    ContractStatus::Approved | ContractStatus::CollateralSeen => {
                        match updated_collateral_sats >= min_collateral {
                            true => {
                                tracing::debug!(
                                    contract_id,
                                    collateral_sats = updated_collateral_sats,
                                    "Collateral confirmed"
                                );

                                (ContractStatus::CollateralConfirmed, true)
                            }
                            false => (contract.status, false),
                        }
                    }
                    ContractStatus::CollateralConfirmed
                    | ContractStatus::PrincipalGiven
                    | ContractStatus::RepaymentProvided
                    | ContractStatus::RepaymentConfirmed
                    | ContractStatus::Undercollateralized
                    | ContractStatus::Defaulted
                    | ContractStatus::Closing
                    | ContractStatus::Closed
                    | ContractStatus::Rejected
                    | ContractStatus::DisputeBorrowerStarted
                    | ContractStatus::DisputeLenderStarted
                    | ContractStatus::DisputeBorrowerResolved
                    | ContractStatus::DisputeLenderResolved
                    | ContractStatus::Cancelled
                    | ContractStatus::RequestExpired => (contract.status, false),
                }
            }
            Ordering::Less => {
                // Currently, we are only tracking adding funds to a collateral output. If the
                // collateral amount decreases, it's probably because an output was reorged
                // away, which is rare.
                tracing::warn!(
                    contract_id,
                    before = current_collateral_sats,
                    after = updated_collateral_sats,
                    "Collateral decreased. This is weird"
                );

                // This is where the limitations of our state machine come into play. Here we're
                // only considering the possibility that `CollateralConfirmed` can
                // go back to to `Approved` after a reorg, but it could happen for
                // other states too. In any case, this is all unlikely.
                match contract.status {
                    ContractStatus::CollateralConfirmed => {
                        match updated_collateral_sats < min_collateral {
                            true => {
                                tracing::warn!(
                                    contract_id,
                                    collateral_sats = updated_collateral_sats,
                                    "Moving contract from CollateralConfirmed back to Approved"
                                );

                                (ContractStatus::Approved, false)
                            }
                            false => (contract.status, false),
                        }
                    }
                    _ => (contract.status, false),
                }
            }
            Ordering::Equal => {
                tracing::trace!(
                    contract_id,
                    collateral_sats = current_collateral_sats,
                    "Collateral has not changed"
                );

                return Ok((contract, false));
            }
        };

    let new_status = db::ContractStatus::from(new_status);

    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            collateral_sats = $1,
            status = $2,
            updated_at = $3
        WHERE id = $4
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_loan_address,
            integration as "integration: crate::model::db::Integration",
            lender_xpub,
            contract_address,
            contract_index,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_months,
            expiry_date,
            contract_version,
            created_at,
            updated_at
        "#,
        updated_collateral_sats as i64,
        new_status as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok((contract.into(), is_newly_confirmed))
}

/// Expires contracts in state Requested and returns their IDs
pub(crate) async fn expire_requested_contracts(
    pool: &Pool<Postgres>,
    expiry_in_hours: i64,
) -> Result<Vec<String>> {
    let expiration_threshold = OffsetDateTime::now_utc() - time::Duration::hours(expiry_in_hours);

    let rows = sqlx::query!(
        r#"
            UPDATE
                contracts
            SET
                status = 'RequestExpired', updated_at = $1
            WHERE
                status = 'Requested' AND
                created_at <= $2
            RETURNING id;
        "#,
        OffsetDateTime::now_utc(),
        expiration_threshold
    )
    .fetch_all(pool)
    .await?;

    let contract_ids = rows.into_iter().map(|row| row.id).collect();

    Ok(contract_ids)
}

pub struct ContractInfo {
    pub contract_id: String,
    pub borrower_id: String,
    pub expiry_date: OffsetDateTime,
}

impl ContractInfo {
    pub fn formatted_expiry_date(&self) -> String {
        let format = format_description::well_known::Rfc3339;

        self.expiry_date
            .to_offset(time::UtcOffset::UTC)
            .format(&format)
            .expect("valid expiry date")
    }
}

/// Fetches contracts with `PrincipalGiven` status that are due to expire within the next 3 days.
pub(crate) async fn close_to_expiry_contracts(
    pool: &Pool<Postgres>,
) -> Result<Vec<ContractInfo>, sqlx::Error> {
    let due_date_start = OffsetDateTime::now_utc();
    let due_date_end = OffsetDateTime::now_utc() + time::Duration::days(3);

    let rows = sqlx::query!(
        r#"
            SELECT id, borrower_id, expiry_date
            FROM contracts
            WHERE
                status = 'PrincipalGiven' AND
                expiry_date > $1 AND
                expiry_date <= $2
        "#,
        due_date_start,
        due_date_end,
    )
    .fetch_all(pool)
    .await?;

    let contracts_info = rows
        .into_iter()
        .map(|row| ContractInfo {
            contract_id: row.id,
            borrower_id: row.borrower_id,
            expiry_date: row.expiry_date,
        })
        .collect();

    Ok(contracts_info)
}

pub(crate) async fn check_if_contract_belongs_to_borrower(
    pool: &Pool<Postgres>,
    contract_id: &str,
    borrower_id: &str,
) -> Result<bool> {
    let row = sqlx::query!(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM contracts WHERE id = $1 AND borrower_id = $2
            ) AS entry_exists;
        "#,
        contract_id,
        borrower_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(row.entry_exists.unwrap_or(false))
}

pub(crate) async fn check_if_contract_belongs_to_lender(
    pool: &Pool<Postgres>,
    contract_id: &str,
    lender_id: &str,
) -> Result<bool> {
    let row = sqlx::query!(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM contracts WHERE id = $1 AND lender_id = $2
            ) AS entry_exists;
        "#,
        contract_id,
        lender_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(row.entry_exists.unwrap_or(false))
}
