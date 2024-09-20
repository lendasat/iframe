import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dispute, DisputeStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import React, { Suspense, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";
import init, { is_wallet_loaded, sign_claim_psbt } from "../../../../../../borrower-wallet/pkg/borrower_wallet.js";
import { UnlockWalletModal } from "../wallet/unlock-wallet-modal";

function ResolveDispute() {
  const { getDispute } = useBorrowerHttpClient();
  const { id } = useParams();
  const { getClaimDisputeCollateralPsbt, postClaimTx, getContract } = useBorrowerHttpClient();
  const [error, setError] = useState("");

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const onWithdrawAction = async (dispute: Dispute) => {
    try {
      await init();

      const isLoaded = is_wallet_loaded();
      if (!isLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }

      await claimCollateralRequest(dispute);
    } catch (err) {
      console.error("Failed to claim collateral", err);
    }
  };

  const claimCollateralRequest = async (dispute: Dispute) => {
    try {
      const contract = await getContract(dispute.contract_id);
      const res = await getClaimDisputeCollateralPsbt(dispute.id);
      console.log(`${JSON.stringify(res)}`);
      const claimTx = sign_claim_psbt(res.psbt, res.collateral_descriptor, contract.borrower_pk);
      const txid = await postClaimTx(contract.id, claimTx);
      alert(`Transaction ${txid} was published!`);
    } catch (error) {
      console.log(`${error}`);
      setError(`${error}`);
    }
  };

  const handleSubmitUnlockWalletModal = async (dispute: Dispute) => {
    handleCloseUnlockWalletModal();
    await claimCollateralRequest(dispute);
  };

  return (
    <Suspense>
      <Await
        resolve={getDispute(id)}
        errorElement={<div>Could not load dispute</div>}
        children={(dispute: Awaited<Dispute>) => (
          <div>
            <UnlockWalletModal
              show={showUnlockWalletModal}
              handleClose={handleCloseUnlockWalletModal}
              handleSubmit={() => handleSubmitUnlockWalletModal(dispute)}
            />
            <div className="card my-3">
              <div className="card-header">
                <h5>Dispute: {dispute.id}</h5>
              </div>
              <div className="card-body">
                <p>
                  <strong>Contract ID:</strong> {dispute.contract_id}
                </p>
                <p>
                  <strong>Borrower ID:</strong> {dispute.borrower_id}
                </p>
                <p>
                  <strong>Lender ID:</strong> {dispute.lender_id}
                </p>
                <p>
                  <strong>Comment:</strong> {dispute.comment}
                </p>
                <p>
                  <strong>Status:</strong> {dispute.status}
                </p>
                <p>
                  <strong>Created At:</strong> {dispute.created_at.toLocaleString()}
                </p>
                <p>
                  <strong>Updated At:</strong> {dispute.updated_at.toLocaleString()}
                </p>

                {dispute.lender_payout_sats && (
                  <p>
                    <strong>Lender Payout (sats):</strong> {dispute.lender_payout_sats}
                  </p>
                )}
                {dispute.borrower_payout_sats && (
                  <p>
                    <strong>Borrower Payout (sats):</strong> {dispute.borrower_payout_sats}
                  </p>
                )}
                <ActionItem dispute={dispute} onWithdrawAction={onWithdrawAction}></ActionItem>
                {error
                  ? (
                    <Alert variant="danger">
                      <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
                      {error}
                    </Alert>
                  )
                  : ""}
              </div>
            </div>
          </div>
        )}
      />
    </Suspense>
  );
}

interface ActionItemProps {
  dispute: Dispute;
  onWithdrawAction: (dispute: Dispute) => void;
}

const ActionItem = ({ dispute, onWithdrawAction }: ActionItemProps) => {
  let actionDisabled = true;

  switch (dispute.status) {
    case DisputeStatus.ResolvedBorrower:
    case DisputeStatus.ResolvedLender:
      actionDisabled = false;
      break;
    case DisputeStatus.StartedBorrower:
    case DisputeStatus.StartedLender:
      actionDisabled = true;
      break;
  }

  return (
    <>
      {actionDisabled
        ? (
          <Alert variant="warning">
            <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
            {"The dispute is still ongoing. Once it's been resolved you will be able to withdraw your collateral."}
          </Alert>
        )
        : ""}
      <Button disabled={actionDisabled} onClick={() => onWithdrawAction(dispute)}>Withdraw collateral</Button>
    </>
  );
};

export default ResolveDispute;
