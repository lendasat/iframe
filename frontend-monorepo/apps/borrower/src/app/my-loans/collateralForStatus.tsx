import { ContractStatus } from "@frontend-monorepo/http-client-borrower";

// Depending on the ContractStatus we want to show the `initial` collateral or the `actual`
// collateral. This is because for certain states the `actual` collateral is 0.
export function collateralForStatus(status: ContractStatus, initial: number, actual: number): number {
  let collateral_btc;
  switch (status) {
    case ContractStatus.Requested:
    case ContractStatus.Approved:
    case ContractStatus.CollateralSeen:
    case ContractStatus.Rejected:
      collateral_btc = initial;
      break;
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      collateral_btc = actual;
      break;
    case ContractStatus.Cancelled:
      collateral_btc = 0;
  }
  return collateral_btc;
}
