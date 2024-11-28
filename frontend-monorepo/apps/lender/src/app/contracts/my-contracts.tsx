import type { Contract } from "@frontend-monorepo/http-client-lender";
import { ContractStatus, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { Box } from "@radix-ui/themes";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import { ClosedContracts } from "./closed-contracts";
import { OpenContracts } from "./open-contracts";

function MyContracts() {
  const { getContracts } = useLenderHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <Box className="h-screen flex flex-col">
            <Box className="flex-1 max-h-1/2 overflow-auto">
              <OpenContracts
                contracts={contracts.filter((loan) =>
                  loan.status !== ContractStatus.Closed && loan.status !== ContractStatus.Cancelled
                  && loan.status !== ContractStatus.RequestExpired
                )}
              />
            </Box>
            <Box className="flex-1 max-h-1/2 overflow-auto">
              <ClosedContracts
                contracts={contracts.filter((loan) =>
                  loan.status === ContractStatus.Closed || loan.status === ContractStatus.Cancelled
                  || loan.status === ContractStatus.RequestExpired
                )}
              />
            </Box>
          </Box>
        )}
      />
    </Suspense>
  );
}

export const actionFromStatus = (status: ContractStatus) => {
  switch (status) {
    case ContractStatus.Requested:
      return "Approve or Reject";
    case ContractStatus.Approved:
      return "Details";
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return "Payout principal";
    case ContractStatus.PrincipalGiven:
      return "Details";
    case ContractStatus.Closed:
    case ContractStatus.Closing:
      return "Details";
    case ContractStatus.RepaymentProvided:
      return "Confirm Repayment";
    case ContractStatus.RepaymentConfirmed:
      return "Details";
    case ContractStatus.Rejected:
      return "Details";
    case ContractStatus.DisputeBorrowerStarted:
      return "Details";
    case ContractStatus.DisputeLenderStarted:
      return "Details";
    case ContractStatus.DisputeBorrowerResolved:
      return "Details";
    case ContractStatus.DisputeLenderResolved:
      return "Details";
    case ContractStatus.RequestExpired:
      return "Details";
    default:
      return "Details";
  }
};

export default MyContracts;
