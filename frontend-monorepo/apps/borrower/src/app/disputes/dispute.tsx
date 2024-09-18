import { Dispute, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Suspense } from "react";
import { Await, useParams } from "react-router-dom";

function ResolveDispute() {
  const { getDispute } = useBorrowerHttpClient();
  const { id } = useParams();

  return (
    <Suspense>
      <Await
        resolve={getDispute(id)}
        errorElement={<div>Could not load dispute</div>}
        children={(dispute: Awaited<Dispute>) => (
          <div>
            <div className="card my-3">
              <div className="card-header">
                <h5>Dispute for Loan ID: {dispute.loan_id}</h5>
              </div>
              <div className="card-body">
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
              </div>
            </div>
          </div>
        )}
      />
    </Suspense>
  );
}

export default ResolveDispute;
