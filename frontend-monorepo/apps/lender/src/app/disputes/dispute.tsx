import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dispute, DisputeStatus, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import React, { Suspense, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";
import init, { is_wallet_loaded, sign_claim_psbt } from "../../../../../../borrower-wallet/pkg/borrower_wallet.js";

function ResolveDispute() {
  const { id } = useParams();
  const { getDispute } = useLenderHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getDispute(id)}
        errorElement={<div>Could not load dispute</div>}
        children={(dispute: Awaited<Dispute>) => (
          <div>
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
                {(dispute.status !== DisputeStatus.ResolvedBorrower && dispute.status !== DisputeStatus.ResolvedLender)
                  ? (
                    <Alert variant="info">
                      <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
                      The dispute is on-going. Please communicate with us via email{" "}
                      <a href={"mailto:dispute@lendasat.com"}>dispute@lendasat.com</a>.
                    </Alert>
                  )
                  : (
                    <Alert variant="info">
                      <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
                      This dispute has been resolved already.
                    </Alert>
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
