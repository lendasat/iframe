import { ContractStatus } from "@lendasat/http-client-borrower";

// Depending on the ContractStatus we want to show the `initial` collateral or the `actual`
// collateral. This is because for certain states the `actual` collateral is 0.
export function collateralForStatus(
  status: ContractStatus,
  initial: number,
  actual: number,
): number {
  let collateral_btc;
  switch (status) {
    case ContractStatus.Requested:
    case ContractStatus.RenewalRequested:
    case ContractStatus.Approved:
    case ContractStatus.CollateralSeen:
    case ContractStatus.Rejected:
      collateral_btc = initial;
      break;
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.Undercollateralized:
    case ContractStatus.Defaulted:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    case ContractStatus.Cancelled:
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
      collateral_btc = actual;
      break;
  }
  return collateral_btc;
}
