import TransactionHistoryDialog from "./transaction-history";
import { LuChevronRight } from "react-icons/lu";
import PayoutPrincipalDialog from "./manage-loan-dialog/payout-principal-dialog";
import {
  Contract,
  ContractStatus,
  InstallmentStatus,
} from "@frontend/http-client-lender";
import { Button } from "@frontend/shadcn";
import ApproveOrRejectStablesDialog from "./approve-dialog/approve-reject-stables-request-dialog";
import ApproveFiatDialog from "./approve-dialog/approve-reject-fiat-request-dialog";
import { Check } from "lucide-react";
import ConfirmRepaymentDialog from "./confirm-repayment-dialog";
import DefaultedOrUndercollateralizedContractDialog from "./manage-loan-dialog/defaulted-contract-dialog";
import { LoanAssetHelper } from "@frontend/ui-shared";
import { ReactElement } from "react";

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
  let button: ReactElement | undefined;

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
      <PayoutPrincipalDialog
        contract={contract}
        refreshContract={refreshContract}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Payout Principal <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </PayoutPrincipalDialog>
    );
  } else if (
    contract.installments.filter((i) => {
      return i.status === InstallmentStatus.Paid;
    }).length > 0
  ) {
    button = (
      <ConfirmRepaymentDialog
        contract={contract}
        refreshContract={refreshContract}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Confirm Payment <LuChevronRight className="ml-1 h-4 w-4" />
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
    button = undefined;
  }

  return (
    <div className="flex w-full flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
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
      <div className="order-1 flex w-full justify-center gap-2 md:order-2 md:justify-end">
        {button}
      </div>
    </div>
  );
}
