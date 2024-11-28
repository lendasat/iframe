use crate::model::db;
use crate::model::Contract;
use crate::model::ContractStatus;
use crate::model::ContractVersion;
use crate::model::Integration;
use anyhow::bail;
use anyhow::Error;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32::Xpub;
use bitcoin::Address;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use std::cmp::Ordering;
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
            contract_version,
            created_at,
            updated_at
        FROM contracts
        WHERE status NOT IN ($1, $2, $3)
        "#,
        db::ContractStatus::Requested as db::ContractStatus,
        db::ContractStatus::Closed as db::ContractStatus,
        db::ContractStatus::Rejected as db::ContractStatus,
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
) -> Result<Contract> {
    let id = id.to_string();
    let initial_collateral_sats = initial_collateral_sats as i64;
    let origination_fee_sats = origination_fee_sats as i64;
    let collateral_sats = 0;
    let integration = db::Integration::from(integration);
    let contract_version = contract_version as i32;

    let lender_id_row = sqlx::query!(
        r#"
        SELECT lender_id
        FROM loan_offers
        WHERE id = $1
        "#,
        loan_id
    )
    .fetch_one(pool)
    .await?;

    let lender_id = lender_id_row.lender_id;

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
            contract_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
        db::ContractStatus::Requested as db::ContractStatus,
        db::LiquidationStatus::Healthy as db::LiquidationStatus,
        borrower_btc_address.assume_checked().to_string(),
        borrower_pk.to_string(),
        borrower_loan_address,
        integration as db::Integration,
        None as Option<String>,
        None as Option<i32>,
        contract_version,
    )
    .fetch_one(pool)
    .await?;

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
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Approved as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
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
) -> Result<Contract> {
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
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::PrincipalGiven as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
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
    update_contract_state(pool, contract_id, db::ContractStatus::RepaymentProvided).await
}

pub async fn mark_contract_as_repayment_confirmed(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
    update_contract_state(pool, contract_id, db::ContractStatus::RepaymentConfirmed).await
}

async fn update_contract_state(
    pool: &Pool<Postgres>,
    contract_id: &str,
    new_status: db::ContractStatus,
) -> Result<Contract, Error> {
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
            contract_version,
            created_at,
            updated_at
        "#,
        new_status as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn mark_contract_as_cancelled(
    pool: &Pool<Postgres>,
    contract_id: &str,
    borrower_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            status = $1,
            updated_at = $2,
            borrower_id = $3
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
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Cancelled as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
        borrower_id,
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn mark_contract_as_closed(pool: &Pool<Postgres>, contract_id: &str) -> Result<Contract> {
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
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Closed as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn mark_contract_as_closing(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<Contract> {
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
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Closing as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
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
            contract_version,
            created_at,
            updated_at
        "#,
        db::ContractStatus::Rejected as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
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
            contract_version,
            created_at,
            updated_at
        "#,
        status as db::LiquidationStatus,
        time::OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub(crate) async fn mark_contract_as(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    contract_id: &str,
    status: db::ContractStatus,
) -> Result<Contract> {
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
            contract_version,
            created_at,
            updated_at
        "#,
        status as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(&mut **transaction)
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
            contract_version,
            created_at,
            updated_at
        FROM contracts
        WHERE status NOT IN ($1, $2, $3, $4, $5) and liquidation_status NOT in ($6)
        "#,
        db::ContractStatus::Requested as db::ContractStatus,
        db::ContractStatus::Approved as db::ContractStatus,
        db::ContractStatus::Closing as db::ContractStatus,
        db::ContractStatus::Closed as db::ContractStatus,
        db::ContractStatus::Rejected as db::ContractStatus,
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

// This function is the cost we have to pay for not modelling things properly.
pub async fn update_collateral(
    pool: &Pool<Postgres>,
    contract_id: &str,
    updated_collateral_sats: u64,
) -> Result<Contract> {
    let contract = load_contract(pool, contract_id).await?;

    let min_collateral = contract.initial_collateral_sats;
    let current_collateral_sats = contract.collateral_sats;

    // The status does not always change, but it's simpler to always write to the database if the
    // collateral changes.
    let new_status = match updated_collateral_sats.cmp(&current_collateral_sats) {
        Ordering::Greater => {
            tracing::debug!(
                contract_id,
                before = current_collateral_sats,
                after = updated_collateral_sats,
                "Collateral increased"
            );

            match contract.status {
                ContractStatus::Requested => {
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

                            ContractStatus::CollateralConfirmed
                        }
                        false => contract.status,
                    }
                }
                ContractStatus::CollateralConfirmed
                | ContractStatus::PrincipalGiven
                | ContractStatus::RepaymentProvided
                | ContractStatus::RepaymentConfirmed
                | ContractStatus::Closing
                | ContractStatus::Closed
                | ContractStatus::Rejected
                | ContractStatus::DisputeBorrowerStarted
                | ContractStatus::DisputeLenderStarted
                | ContractStatus::DisputeBorrowerResolved
                | ContractStatus::DisputeLenderResolved
                | ContractStatus::Cancelled
                | ContractStatus::RequestExpired => contract.status,
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

            // This is where the limitations of our state machine come into play. Here we're only
            // considering the possibility that `CollateralConfirmed` can go back to to `Approved`
            // after a reorg, but it could happen for other states too. In any case,
            // this is all unlikely.
            match contract.status {
                ContractStatus::CollateralConfirmed => {
                    match updated_collateral_sats < min_collateral {
                        true => {
                            tracing::warn!(
                                contract_id,
                                collateral_sats = updated_collateral_sats,
                                "Moving contract from CollateralConfirmed back to Approved"
                            );

                            ContractStatus::Approved
                        }
                        false => contract.status,
                    }
                }
                _ => contract.status,
            }
        }
        Ordering::Equal => {
            tracing::trace!(
                contract_id,
                collateral_sats = current_collateral_sats,
                "Collateral has not changed"
            );

            return Ok(contract);
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
            contract_version,
            created_at,
            updated_at
        "#,
        updated_collateral_sats as i64,
        new_status as db::ContractStatus,
        time::OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}
