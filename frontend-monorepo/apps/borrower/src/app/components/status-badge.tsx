import { ContractStatus } from "@frontend/http-client-borrower";
import { Badge } from "@radix-ui/themes";

export interface StatusBadgeProps {
  status: ContractStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let color:
    | "gray"
    | "gold"
    | "bronze"
    | "brown"
    | "yellow"
    | "amber"
    | "orange"
    | "tomato"
    | "red"
    | "ruby"
    | "crimson"
    | "pink"
    | "plum"
    | "purple"
    | "violet"
    | "iris"
    | "indigo"
    | "blue"
    | "cyan"
    | "teal"
    | "jade"
    | "green"
    | "grass"
    | "lime"
    | "mint"
    | "sky" = "green";
  let label = "";

  switch (status) {
    case ContractStatus.Requested:
      color = "yellow";
      label = "Requested";
      break;
    case ContractStatus.RenewalRequested:
      color = "yellow";
      label = "Renewal Requested";
      break;
    case ContractStatus.Approved:
      color = "green";
      label = "Approved";
      break;
    case ContractStatus.CollateralSeen:
      color = "green";
      label = "Collateral Seen";
      break;
    case ContractStatus.CollateralConfirmed:
      color = "green";
      label = "Collateral Confirmed";
      break;
    case ContractStatus.PrincipalGiven:
      color = "green";
      label = "Principal Given";
      break;
    case ContractStatus.RepaymentProvided:
      color = "gray";
      label = "Repayment Provided";
      break;
    case ContractStatus.RepaymentConfirmed:
      color = "gray";
      label = "Repayment Confirmed";
      break;
    case ContractStatus.Closing:
      color = "gray";
      label = "Closing";
      break;
    case ContractStatus.Undercollateralized:
      color = "red";
      label = "Awaiting Liquidation";
      break;
    case ContractStatus.Defaulted:
      color = "red";
      label = "Defaulted";
      break;
    case ContractStatus.Closed:
      color = "gray";
      label = "Closed";
      break;
    case ContractStatus.Extended:
      color = "gray";
      label = "Extended";
      break;
    case ContractStatus.RequestExpired:
      color = "gray";
      label = "Expired";
      break;
    case ContractStatus.ApprovalExpired:
      color = "gray";
      label = "Expired";
      break;
    case ContractStatus.Rejected:
      color = "red";
      label = "Rejected";
      break;
    case ContractStatus.DisputeBorrowerStarted:
      color = "red";
      label = "Dispute Started";
      break;
    case ContractStatus.DisputeLenderStarted:
      color = "red";
      label = "Dispute Started";
      break;
    case ContractStatus.DisputeBorrowerResolved:
      color = "orange";
      label = "Dispute Resolved";
      break;
    case ContractStatus.DisputeLenderResolved:
      color = "orange";
      label = "Dispute Resolved";
      break;
    case ContractStatus.Cancelled:
      color = "gray";
      label = "Contract Cancelled";
      break;
  }

  return (
    <Badge variant="soft" size={"2"} color={color} radius="medium">
      {label}
    </Badge>
  );
}
