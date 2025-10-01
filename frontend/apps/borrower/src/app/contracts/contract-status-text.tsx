import { Contract, ContractStatus } from "@frontend/http-client-borrower";
import { Skeleton } from "@frontend/shadcn";
import { Info, TriangleAlert, Check, X, Clock } from "lucide-react";
import { add, format, formatDistanceToNowStrict } from "date-fns";
import { Link } from "react-router-dom";

interface LoanStatusInformationProps {
  contract?: Contract;
}

function LoanStatusInformation({ contract }: LoanStatusInformationProps) {
  if (contract === undefined) {
    return (
      <div className="flex items-start rounded-md border border-gray-200 bg-gray-50 p-4">
        <Skeleton className="mx-4 h-5 w-5 rounded-full" />
        <div>
          <Skeleton className="mb-2 h-6 w-[150px]" />
          <Skeleton className="h-4 w-[450px]" />
        </div>
      </div>
    );
  }

  const expiryDate = format(contract.expiry, "MMM, dd yyyy - p");

  const actionExpiryDate = add(contract.created_at, { hours: 24 });
  const actionExpiryDateFormated = format(actionExpiryDate, "MMM, dd yyyy - p");
  const actionExpiresIn = formatDistanceToNowStrict(actionExpiryDate);

  let icon = <Info className="mr-2 mt-0.5 h-5 w-5 text-blue-500" />;
  let bgColor = "bg-blue-50";
  let borderColor = "border-blue-200";
  let titleColor = "text-blue-800";
  let textColor = "text-blue-600";
  let title = "Loan Status Information";
  let message = <>"Your loan information is being processed."</>;

  switch (contract.status) {
    case ContractStatus.Requested:
      icon = <Clock className="mr-2 mt-0.5 h-5 w-5 text-blue-500" />;
      message = (
        <>
          Your loan request is awaiting lender approval. The lender has{" "}
          <span className="font-bold">{actionExpiresIn}</span>, but must respond
          by <span className="font-bold">{actionExpiryDateFormated}</span> at
          the latest.
        </>
      );
      break;

    case ContractStatus.Approved:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-indigo-500" />;
      bgColor = "bg-indigo-50";
      borderColor = "border-indigo-200";
      titleColor = "text-indigo-800";
      textColor = "text-indigo-600";
      title = "Loan Approved";
      message = (
        <>
          Your loan has been approved! Please provide collateral to proceed
          within <span className="font-bold">{actionExpiresIn}</span> but not
          later than{" "}
          <span className="font-bold">{actionExpiryDateFormated}</span>.
        </>
      );
      break;

    case ContractStatus.CollateralSeen:
      icon = <Clock className="mr-2 mt-0.5 h-5 w-5 text-violet-500" />;
      bgColor = "bg-violet-50";
      borderColor = "border-violet-200";
      titleColor = "text-violet-800";
      textColor = "text-violet-600";
      title = "Collateral Pending";
      message = (
        // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
        <>
          Your collateral has been seen on the blockchain and is waiting for
          confirmation.
        </>
      );
      break;

    case ContractStatus.CollateralConfirmed:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-violet-500" />;
      bgColor = "bg-violet-50";
      borderColor = "border-violet-200";
      titleColor = "text-violet-800";
      textColor = "text-violet-600";
      title = "Collateral Confirmed";
      message = (
        // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
        <>
          Your collateral has been confirmed. The lender will send the principal
          amount soon.
        </>
      );
      break;

    case ContractStatus.PrincipalGiven:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-green-500" />;
      bgColor = "bg-green-50";
      borderColor = "border-green-200";
      titleColor = "text-green-800";
      textColor = "text-green-600";
      title = "Loan Active";
      message = (
        <>
          Your loan is active and in good standing. Loan expires on {expiryDate}
        </>
      );
      break;

    case ContractStatus.RepaymentProvided:
      icon = <Clock className="mr-2 mt-0.5 h-5 w-5 text-teal-500" />;
      bgColor = "bg-teal-50";
      borderColor = "border-teal-200";
      titleColor = "text-teal-800";
      textColor = "text-teal-600";
      title = "Payment Processing";
      message = (
        // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
        <>Your repayment has been submitted and is waiting for confirmation.</>
      );
      break;

    case ContractStatus.RepaymentConfirmed:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-emerald-500" />;
      bgColor = "bg-emerald-50";
      borderColor = "border-emerald-200";
      titleColor = "text-emerald-800";
      textColor = "text-emerald-600";
      title = "Repayment Confirmed";
      message = (
        // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
        <>
          Your repayment has been confirmed. You can withdraw your collateral.
        </>
      );
      break;

    case ContractStatus.Undercollateralized:
      icon = <TriangleAlert className="mr-2 mt-0.5 h-5 w-5 text-red-500" />;
      bgColor = "bg-red-50";
      borderColor = "border-red-200";
      titleColor = "text-red-800";
      textColor = "text-red-600";
      title = "Margin Call";
      message = (
        // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
        <>
          Your loan is under-collateralized and the lender has been informed to
          liquidate it.
        </>
      );
      break;

    case ContractStatus.Defaulted:
      icon = <X className="mr-2 mt-0.5 h-5 w-5 text-red-500" />;
      bgColor = "bg-red-50";
      borderColor = "border-red-200";
      titleColor = "text-red-800";
      textColor = "text-red-600";
      title = "Loan Defaulted";
      message = (
        <>
          Your defaulted on one of your loan installments. Your collateral will
          be liquidated and the remaining funds returned to you.
        </>
      );
      break;

    case ContractStatus.ClosingByClaim:
    case ContractStatus.ClosingByDefaulting:
    case ContractStatus.ClosingByLiquidation:
    case ContractStatus.ClosingByRecovery:
      icon = <Clock className="mr-2 mt-0.5 h-5 w-5 text-slate-500" />;
      bgColor = "bg-slate-50";
      borderColor = "border-slate-200";
      titleColor = "text-slate-800";
      textColor = "text-slate-600";
      title = "Loan Closing";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>Your loan is in the process of closing.</>;
      break;

    case ContractStatus.Closed:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-gray-500" />;
      bgColor = "bg-gray-50";
      borderColor = "border-gray-200";
      titleColor = "text-gray-800";
      textColor = "text-gray-600";
      title = "Loan Closed";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>This loan has been fully repaid and closed.</>;
      break;

    case ContractStatus.ClosedByDefaulting:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-gray-500" />;
      bgColor = "bg-gray-50";
      borderColor = "border-gray-200";
      titleColor = "text-gray-800";
      textColor = "text-gray-600";
      title = "Loan Closed";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>This loan has been closed due to defaulting.</>;
      break;

    case ContractStatus.ClosedByLiquidation:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-gray-500" />;
      bgColor = "bg-gray-50";
      borderColor = "border-gray-200";
      titleColor = "text-gray-800";
      textColor = "text-gray-600";
      title = "Loan Closed";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>This loan has been liquidated.</>;
      break;

    case ContractStatus.Extended:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-purple-500" />;
      bgColor = "bg-purple-50";
      borderColor = "border-purple-200";
      titleColor = "text-purple-800";
      textColor = "text-purple-600";
      title = "Loan Extended";
      message = (
        <>
          Your loan term has been extended and replaced by
          <Link
            to={`/my-contracts/${contract.extended_by_contract}`}
            className="text-purple-600 underline hover:text-purple-700"
          >
            {" "}
            a new loan.
          </Link>
        </>
      );
      break;

    case ContractStatus.Rejected:
      icon = <X className="mr-2 mt-0.5 h-5 w-5 text-rose-500" />;
      bgColor = "bg-rose-50";
      borderColor = "border-rose-200";
      titleColor = "text-rose-800";
      textColor = "text-rose-600";
      title = "Loan Request Rejected";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>Your loan request has been rejected by the lender.</>;
      break;

    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      icon = <TriangleAlert className="mr-2 mt-0.5 h-5 w-5 text-orange-500" />;
      bgColor = "bg-orange-50";
      borderColor = "border-orange-200";
      titleColor = "text-orange-800";
      textColor = "text-orange-600";
      title = "Dispute Open";
      message = (
        // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
        <>
          A dispute has been opened for this loan. Please check the
          communication channel.
        </>
      );
      break;

    case ContractStatus.Cancelled:
      icon = <X className="mr-2 mt-0.5 h-5 w-5 text-zinc-500" />;
      bgColor = "bg-zinc-50";
      borderColor = "border-zinc-200";
      titleColor = "text-zinc-800";
      textColor = "text-zinc-600";
      title = "Loan Cancelled";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>This loan request has been cancelled.</>;
      break;

    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
      icon = <Clock className="mr-2 mt-0.5 h-5 w-5 text-stone-500" />;
      bgColor = "bg-stone-50";
      borderColor = "border-stone-200";
      titleColor = "text-stone-800";
      textColor = "text-stone-600";
      title = "Loan Request Expired";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>This loan request has expired due to inactivity.</>;
      break;

    case ContractStatus.CollateralRecoverable:
      icon = <TriangleAlert className="mr-2 mt-0.5 h-5 w-5 text-amber-500" />;
      bgColor = "bg-amber-50";
      borderColor = "border-amber-200";
      titleColor = "text-amber-800";
      textColor = "text-amber-600";
      title = "Collateral Recovery Available";
      message = (
        // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
        <>
          The lender has failed to disburse the principal in time. You can now
          recover your collateral.
        </>
      );
      break;

    case ContractStatus.ClosedByRecovery:
      icon = <Check className="mr-2 mt-0.5 h-5 w-5 text-gray-500" />;
      bgColor = "bg-gray-50";
      borderColor = "border-gray-200";
      titleColor = "text-gray-800";
      textColor = "text-gray-600";
      title = "Loan Closed";
      // biome-ignore lint/complexity/noUselessFragments: wanted fragment.
      message = <>This loan has been closed after recovering the collateral.</>;
      break;
  }

  return (
    <>
      <div
        className={`${bgColor} rounded-md border p-4 ${borderColor} flex items-start`}
      >
        {icon}
        <div>
          <p className={`text-sm font-medium ${titleColor}`}>{title}</p>
          <p className={`text-sm ${textColor}`}>{message}</p>
        </div>
      </div>
    </>
  );
}

export default LoanStatusInformation;
