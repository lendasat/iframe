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
) -> anyhow::Result<(Contract, bool)> {
    let contract = load_contract(pool, contract_id).await?;

    let min_collateral = contract.initial_collateral_sats;
    let current_collateral_sats = contract.collateral_sats;

    if updated_collateral_sats == current_collateral_sats {
        // nothing has changed, we can return early
        return Ok((contract, false));
    }

    if updated_collateral_sats < min_collateral {
        // The balance was reduced below [`min_collateral`], which means likely that a tx we have
        // seen before fell out of the mempool or we had a re-org
        if contract.status == ContractStatus::CollateralConfirmed
            || contract.status == ContractStatus::CollateralSeen
        {
            tracing::warn!(
                contract_id = contract_id,
                old_collateral_sats = current_collateral_sats,
                new_collateral_sats = updated_collateral_sats,
                status = ?contract.status,
                "Collateral has been reduced of a newly funded contract"
            );
            // TODO: change contract status to [`ContractStatus::Approved`]
        } else {
            tracing::error!(
                contract_id = contract_id,
                old_collateral_sats = current_collateral_sats,
                new_collateral_sats = updated_collateral_sats,
                status = ?contract.status,
                "Collateral has been reduced of a contract in an unexpected state"
            );
        }
    }

    if contract.status == ContractStatus::Approved {
        // if the contract was just approved, now can move on
        let status = if updated_collateral_sats > min_collateral {
            // TODO: support collateral seen
            ContractStatus::CollateralConfirmed
        } else {
            ContractStatus::Approved
        };
        let contract =
            update_status_and_collateral(pool, contract_id, updated_collateral_sats, status)
                .await?;
        return Ok((contract, true));
    }

    // else, the contract is already funded, we just update the collateral
    update_collateral_sats(pool, contract_id, updated_collateral_sats).await?;
    let contract = Contract {
        collateral_sats: updated_collateral_sats,
        ..contract
    };

    Ok((contract, false))
}
