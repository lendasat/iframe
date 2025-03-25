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
import { Await, useParams } from "react-router-dom";
import {
  Button,
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/shadcn";

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
        contract.derivation_path,
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
          <Alert className="border-red-400 bg-red-100 text-red-700">
            <AlertDescription>Could not load dispute</AlertDescription>
          </Alert>
        }
        children={(dispute: Awaited<Dispute>) => (
          <div>
            <UnlockWalletModal
              show={showUnlockWalletModal}
              handleClose={handleCloseUnlockWalletModal}
              handleSubmit={() => handleSubmitUnlockWalletModal(dispute)}
            />
            <Card className="my-3">
              <CardHeader>
                <CardTitle>Dispute: {dispute.id}</CardTitle>
              </CardHeader>
              <CardContent>
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
                />
                {error && (
                  <Alert className="mt-3 border-red-400 bg-red-100 text-red-700">
                    <FontAwesomeIcon
                      icon={faExclamationCircle}
                      className="mr-2 h-4 w-4"
                    />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
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
      {actionDisabled && (
        <Alert className="mt-3 border-yellow-400 bg-yellow-100 text-yellow-700">
          <FontAwesomeIcon
            icon={faExclamationCircle}
            className="mr-2 h-4 w-4"
          />
          <AlertDescription>
            The dispute is still ongoing. Once it's been resolved you will be
            able to withdraw your collateral.
          </AlertDescription>
        </Alert>
      )}
      {!actionDisabled && <FeeSelector onSelectFee={onFeeSelected} />}
      <Button
        disabled={actionDisabled}
        onClick={() => onWithdrawAction(dispute)}
        className="mt-3"
      >
        Withdraw collateral
      </Button>
    </>
  );
};

export default ResolveDispute;
