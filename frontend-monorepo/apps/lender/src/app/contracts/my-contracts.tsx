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
        errorElement={<div className={"text-font dark:text-font-dark"}>Could not load contracts</div>}
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
    case ContractStatus.CollateralConfirmed:
      return "Pay out principal";
    case ContractStatus.RepaymentProvided:
      return "Confirm repayment";
    case ContractStatus.Approved:
    case ContractStatus.Rejected:
    case ContractStatus.RequestExpired:
    case ContractStatus.CollateralSeen:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    case ContractStatus.Closed:
    case ContractStatus.Closing:
    case ContractStatus.Cancelled:
      return "Details";
  }
};

export default MyContracts;
