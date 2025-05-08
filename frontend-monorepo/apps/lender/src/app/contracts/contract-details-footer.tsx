import TransactionHistoryDialog from "./transaction-history";
import { LuChevronRight } from "react-icons/lu";
import PayoutPrincipleDialog from "./manage-loan-dialig/payout-principle-dialog";
import React from "react";
import { Contract, ContractStatus } from "@frontend/http-client-lender";
import { Button } from "@frontend/shadcn";
import ApproveOrRejectStablesDialog from "./approve-dialog/approve-reject-stables-request-dialog";
import ApproveOrRejectFiatDialog from "./approve-dialog/approve-reject-fiat-request-dialog";
import { Check } from "lucide-react";
import ApproveOrRejectExtensionDialog from "./approve-reject-extension-dialog";
import ConfirmRepaymentDialog from "./confirm-repayment-dialog";
import DefaultedOrUndercollateralizedContractDialog from "./manage-loan-dialig/defaulted-contract-dialog";
import { LoanAssetHelper } from "@frontend/ui-shared";

interface ContractDetailsFooterProps {
  contract?: Contract;
  loading: boolean;
}

export function ContractDetailsFooter({
  contract,
  loading,
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
        <ApproveOrRejectFiatDialog contract={contract}>
          <Button type={"button"} variant="default" disabled={buttonDisabled}>
            <Check className="mr-1 h-4 w-4" />
            Approve or Reject Request
          </Button>
        </ApproveOrRejectFiatDialog>
      );
    } else {
      button = (
        <ApproveOrRejectStablesDialog contract={contract}>
          <Button type={"button"} variant="default" disabled={buttonDisabled}>
            <Check className="mr-1 h-4 w-4" />
            Approve or Reject Request
          </Button>
        </ApproveOrRejectStablesDialog>
      );
    }
  } else if (contract.status === ContractStatus.CollateralConfirmed) {
    button = (
      <PayoutPrincipleDialog contract={contract}>
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
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Accept or Reject Renewal <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </ApproveOrRejectExtensionDialog>
    );
  } else if (contract.status === ContractStatus.RepaymentProvided) {
    button = (
      <ConfirmRepaymentDialog contract={contract}>
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
      <DefaultedOrUndercollateralizedContractDialog contract={contract}>
        <Button type={"button"} disabled={buttonDisabled}>
          Liquidate <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </DefaultedOrUndercollateralizedContractDialog>
    );
  } else {
    button = <></>;
  }

  return (
    <>
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
      {button}
    </>
  );
}
