import TransactionHistoryDialog from "./transaction-history";
import { LuChevronRight } from "react-icons/lu";
import PayoutPrincipleDialog from "./manage-loan-dialog/payout-principle-dialog";
import { Contract, ContractStatus } from "@frontend/http-client-lender";
import { Button } from "@frontend/shadcn";
import ApproveOrRejectStablesDialog from "./approve-dialog/approve-reject-stables-request-dialog";
import ApproveFiatDialog from "./approve-dialog/approve-reject-fiat-request-dialog";
import { Check } from "lucide-react";
import ApproveOrRejectExtensionDialog from "./approve-reject-extension-dialog";
import ConfirmRepaymentDialog from "./confirm-repayment-dialog";
import DefaultedOrUndercollateralizedContractDialog from "./manage-loan-dialog/defaulted-contract-dialog";
import { LoanAssetHelper } from "@frontend/ui-shared";

interface ContractDetailsFooterProps {
  contract?: Contract;
  loading: boolean;
  refreshContract: () => void;
}

export function ContractDetailsFooter({
  contract,
  loading,
  refreshContract,
}: ContractDetailsFooterProps) {
  let button;

  const buttonDisabled =
    contract?.status === ContractStatus.DisputeLenderStarted ||
    contract?.status === ContractStatus.DisputeBorrowerStarted;
  if (!contract) {
    button = undefined;
  } else if (contract.status === ContractStatus.Requested) {
    if (LoanAssetHelper.isFiat(contract.loan_asset)) {
      button = (
        <ApproveFiatDialog
          contract={contract}
          refreshContract={refreshContract}
        >
          <Button type={"button"} variant="default" disabled={buttonDisabled}>
            <Check className="h-4 w-4" />
            Approve Request
          </Button>
        </ApproveFiatDialog>
      );
    } else {
      button = (
        <ApproveOrRejectStablesDialog
          contract={contract}
          refreshContract={refreshContract}
        >
          <Button type={"button"} variant="default" disabled={buttonDisabled}>
            <Check className="h-4 w-4" />
            Approve or Reject Request
          </Button>
        </ApproveOrRejectStablesDialog>
      );
    }
  } else if (contract.status === ContractStatus.CollateralConfirmed) {
    button = (
      <PayoutPrincipleDialog
        contract={contract}
        refreshContract={refreshContract}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Payout Principal <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </PayoutPrincipleDialog>
    );
  } else if (contract.status === ContractStatus.RenewalRequested) {
    button = (
      <ApproveOrRejectExtensionDialog
        contractId={contract.id}
        loanAmount={contract.loan_amount}
        interestAmount={contract.interest}
        expiry={contract.expiry}
        refreshContract={refreshContract}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Accept or Reject Renewal <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </ApproveOrRejectExtensionDialog>
    );
  } else if (contract.status === ContractStatus.RepaymentProvided) {
    button = (
      <ConfirmRepaymentDialog
        contract={contract}
        refreshContract={refreshContract}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Confirm Repayment <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </ConfirmRepaymentDialog>
    );
  } else if (
    contract.status === ContractStatus.Defaulted ||
    contract.status === ContractStatus.Undercollateralized
  ) {
    button = (
      <DefaultedOrUndercollateralizedContractDialog
        contract={contract}
        refreshContract={refreshContract}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Liquidate <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </DefaultedOrUndercollateralizedContractDialog>
    );
  } else {
    button = <></>;
  }

  return (
    <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 w-full">
      <div className="order-2 md:order-1">
        <TransactionHistoryDialog
          transactions={contract?.transactions || []}
          isLoading={loading}
          contractStatus={contract?.status}
          assetType={contract?.loan_asset}
        >
          <div>
            <Button
              variant="outline"
              typeof={"button"}
              disabled={buttonDisabled}
              className={"flex sm:hidden"}
            >
              View History
            </Button>
            <Button
              variant="outline"
              typeof={"button"}
              disabled={buttonDisabled}
              className={"hidden md:flex"}
            >
              View Transaction History
            </Button>
          </div>
        </TransactionHistoryDialog>
      </div>
      <div className="order-1 md:order-2 w-full flex gap-2 md:justify-end justify-center">
        {button}
      </div>
    </div>
  );
}
