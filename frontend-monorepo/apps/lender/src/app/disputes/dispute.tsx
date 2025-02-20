import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Dispute } from "@lendasat/http-client-lender";
import {
  DisputeStatus,
  useLenderHttpClient,
} from "@lendasat/http-client-lender";
import { Suspense } from "react";
import { Alert } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";

function ResolveDispute() {
  const { id } = useParams();
  const { getDispute } = useLenderHttpClient();

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
            <div className="card my-3 bg-light dark:bg-dark">
              <div className="card-header">
                <h5 className={"text-font dark:text-font-dark"}>
                  Dispute: {dispute.id}
                </h5>
              </div>
              <div className="card-body dark:bg-dark-700 text-font dark:text-font-dark">
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
                {dispute.status !== DisputeStatus.ResolvedBorrower &&
                dispute.status !== DisputeStatus.ResolvedLender ? (
                  <Alert variant="info">
                    <FontAwesomeIcon
                      icon={faExclamationCircle}
                      className="h-4 w-4 mr-2"
                    />
                    The dispute is on-going. Please communicate with us via
                    email{" "}
                    <a href={"mailto:dispute@lendasat.com"}>
                      dispute@lendasat.com
                    </a>
                    .
                  </Alert>
                ) : (
                  <Alert variant="info">
                    <FontAwesomeIcon
                      icon={faExclamationCircle}
                      className="h-4 w-4 mr-2"
                    />
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

export default ResolveDispute;
