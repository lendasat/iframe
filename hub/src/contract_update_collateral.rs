use crate::db::contracts::load_contract;
use crate::db::contracts::update_collateral_sats;
use crate::db::contracts::update_status_and_collateral;
use crate::model::Contract;
use crate::model::ContractStatus;
use sqlx::Pool;
use sqlx::Postgres;

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
    all_unconfirmed: bool,
) -> anyhow::Result<(Contract, bool)> {
    let contract = load_contract(pool, contract_id).await?;

    let min_collateral = contract.initial_collateral_sats;
    let current_collateral_sats = contract.collateral_sats;

    if updated_collateral_sats == current_collateral_sats {
        if contract.status == ContractStatus::CollateralSeen && !all_unconfirmed {
            let contract = update_status_and_collateral(
                pool,
                contract_id,
                updated_collateral_sats,
                ContractStatus::CollateralConfirmed,
            )
            .await?;
            return Ok((contract, true));
        } else {
            // nothing has changed, we can return early
            return Ok((contract, false));
        }
    }

    if updated_collateral_sats < current_collateral_sats {
        // The balance was reduced which means the borrower either withdrew excess collateral or a
        // tx which we have seen before fell out of the mempool or we had a re-org
        if contract.status == ContractStatus::CollateralConfirmed
            || contract.status == ContractStatus::CollateralSeen
        {
            // we do not allow withdrawing excess collateral if we are not fully funded yet, hence,
            // we assume the only reason why it has been reduced is due to a re-org.
            // in this case, we go back to [`ContractStatus::Approved`]
            tracing::warn!(
                contract_id = contract_id,
                old_collateral_sats = current_collateral_sats,
                new_collateral_sats = updated_collateral_sats,
                status = ?contract.status,
                "Collateral has been reduced of a newly funded contract"
            );
            let contract = update_status_and_collateral(
                pool,
                contract_id,
                updated_collateral_sats,
                ContractStatus::Approved,
            )
            .await?;
            return Ok((contract, false));
        } else if updated_collateral_sats == 0 {
            let status = match contract.status {
                ContractStatus::ClosingByClaim => ContractStatus::Closed,
                ContractStatus::ClosingByLiquidation => ContractStatus::ClosedByLiquidation,
                ContractStatus::ClosingByDefaulting => ContractStatus::ClosedByDefaulting,
                ContractStatus::ClosingByRecovery => ContractStatus::ClosedByRecovery,
                status => status,
            };
            tracing::info!(
                contract_id = contract_id,
                old_status = ?contract.status,
                new_status = ?status,
                "All funds withdrawn, set contract to closed"
            );
            let contract =
                update_status_and_collateral(pool, contract_id, updated_collateral_sats, status)
                    .await?;
            return Ok((contract, false));
        } else {
            // the collateral has been reduced. This will happen once we have "withdraw excess
            // collateral"
            tracing::error!(
                contract_id = contract_id,
                old_collateral_sats = current_collateral_sats,
                new_collateral_sats = updated_collateral_sats,
                status = ?contract.status,
                "Collateral has been reduced of a contract in an unexpected state"
            );
        }
    }
    // Else, collateral has been increased
    if contract.status == ContractStatus::Approved
        || contract.status == ContractStatus::CollateralSeen
    {
        // if the contract was just approved, now can move on
        let status = if updated_collateral_sats >= min_collateral {
            if all_unconfirmed {
                ContractStatus::CollateralSeen
            } else {
                ContractStatus::CollateralConfirmed
            }
        } else {
            ContractStatus::Approved
        };
        let contract =
            update_status_and_collateral(pool, contract_id, updated_collateral_sats, status)
                .await?;
        return Ok((contract, true));
    }

    // else, the contract is already funded, we just update the collateral
    tracing::debug!(
        contract_id = contract_id,
        contract_status = ?contract.status,
        "Contract collateral has been increased");

    update_collateral_sats(pool, contract_id, updated_collateral_sats).await?;
    let contract = Contract {
        collateral_sats: updated_collateral_sats,
        ..contract
    };

    Ok((contract, false))
}
