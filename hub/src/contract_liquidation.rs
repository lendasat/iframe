use crate::mempool;
use crate::wallet::Wallet;
use anyhow::anyhow;
use anyhow::bail;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::Address;
use bitcoin::Psbt;
use bitcoin::PublicKey;
use bitcoin_units::Amount;
use miniscript::Descriptor;
use tokio::sync::MutexGuard;

pub async fn prepare_liquidation_psbt(
    wallet: &mut MutexGuard<'_, Wallet>,
    contract: crate::model::Contract,
    address: Address<NetworkUnchecked>,
    lender_amount: Amount,
    contract_index: u32,
    mempool: xtra::Address<mempool::Actor>,
    fee_rate_sats_per_vbyte: u64,
) -> Result<(Descriptor<PublicKey>, PublicKey, Psbt)> {
    let contract_address = contract
        .contract_address
        .ok_or_else(|| anyhow!("Database error: missing contract address",))?;

    let lender_xpub = contract
        .lender_xpub
        .ok_or_else(|| anyhow!("Database error: missing lender Xpub",))?;

    let collateral_outputs = mempool
        .send(mempool::GetCollateralOutputs(contract_address))
        .await
        .expect("actor to be alive");

    if collateral_outputs.is_empty() {
        bail!("Database error: missing collateral outputs",);
    }

    let origination_fee = Amount::from_sat(contract.origination_fee_sats);

    let (psbt, collateral_descriptor, lender_pk) = wallet.create_liquidation_psbt(
        contract.borrower_xpub.as_ref(),
        contract.borrower_pk,
        &lender_xpub,
        contract_index,
        collateral_outputs,
        origination_fee,
        lender_amount,
        address.assume_checked(),
        contract.borrower_btc_address.assume_checked(),
        fee_rate_sats_per_vbyte,
        contract.contract_version,
    )?;

    Ok((collateral_descriptor, lender_pk, psbt))
}
