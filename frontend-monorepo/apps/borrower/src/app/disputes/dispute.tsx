import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import type { Dispute } from "@frontend/http-client-borrower";
import {
  DisputeStatus,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import { FeeSelector } from "@frontend/mempool";
import { Suspense, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";

function ResolveDispute() {
  const { getDispute } = useBorrowerHttpClient();
  const { id } = useParams();
  const { getClaimDisputeCollateralPsbt, postClaimTx, getContract } =
    useBorrowerHttpClient();
  const [error, setError] = useState("");
  const [selectedFee, setSelectedFee] = useState(1);

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const { isWalletLoaded, signClaimPsbt } = useWallet();

  const onWithdrawAction = async (dispute: Dispute) => {
    try {
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      } else {
        await claimCollateralRequest(dispute);
      }
    } catch (err) {
      console.error("Failed to claim collateral", err);
    }
  };

  const claimCollateralRequest = async (dispute: Dispute) => {
    try {
      const contract = await getContract(dispute.contract_id);
      const res = await getClaimDisputeCollateralPsbt(dispute.id, selectedFee);
      console.log(`${JSON.stringify(res)}`);
      const claimTx = await signClaimPsbt(
        res.psbt,
        res.collateral_descriptor,
        res.borrower_pk,
      );
      const txid = await postClaimTx(contract.id, claimTx.tx);
      alert(`Transaction ${txid} was published!`);
    } catch (error) {
      console.log(`${error}`);
      setError(`${error}`);
    }
  };

  const handleSubmitUnlockWalletModal = async (_: Dispute) => {
    handleCloseUnlockWalletModal();
  };

  return (
    <Suspense>
      <Await
        resolve={id ? getDispute(id) : null}
        errorElement={
          <div className={"text-font dark:text-font-dark"}>
            Could not load dispute
          </div>
        }
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
                  <strong>Created At:</strong>{" "}
                  {dispute.created_at.toLocaleString()}
                </p>
                <p>
                  <strong>Updated At:</strong>{" "}
                  {dispute.updated_at.toLocaleString()}
                </p>

                {dispute.lender_payout_sats && (
                  <p>
                    <strong>Lender Payout (sats):</strong>{" "}
                    {dispute.lender_payout_sats}
                  </p>
                )}
                {dispute.borrower_payout_sats && (
                  <p>
                    <strong>Borrower Payout (sats):</strong>{" "}
                    {dispute.borrower_payout_sats}
                  </p>
                )}
                <ActionItem
                  dispute={dispute}
                  onWithdrawAction={onWithdrawAction}
                  onFeeSelected={setSelectedFee}
                ></ActionItem>
                {error ? (
                  <Alert variant="danger">
                    <FontAwesomeIcon
                      icon={faExclamationCircle}
                      className="mr-2 h-4 w-4"
                    />
                    {error}
                  </Alert>
                ) : (
                  ""
                )}
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
  onFeeSelected: (fee: number) => void;
}

const ActionItem = ({
  dispute,
  onWithdrawAction,
  onFeeSelected,
}: ActionItemProps) => {
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
      {actionDisabled ? (
        <Alert variant="warning">
          <FontAwesomeIcon
            icon={faExclamationCircle}
            className="mr-2 h-4 w-4"
          />
          {
            "The dispute is still ongoing. Once it's been resolved you will be able to withdraw your collateral."
          }
        </Alert>
      ) : (
        ""
      )}
      {!actionDisabled ? <FeeSelector onSelectFee={onFeeSelected} /> : null}
      <Button
        disabled={actionDisabled}
        onClick={() => onWithdrawAction(dispute)}
      >
        Withdraw collateral
      </Button>
    </>
  );
};

export default ResolveDispute;
