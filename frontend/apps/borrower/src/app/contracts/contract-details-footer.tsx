import TransactionHistoryDialog from "./transaction-history";
import AddCollateralDialog from "./add-collateral-dialog";
import CancelRequestDialog from "./cancel-request-dialog";
import { LuBan, LuChevronRight, LuDownload } from "react-icons/lu";
import WithdrawCollateralDialog from "./manage-loan-dialog/withdraw-collateral";
import RecoverCollateralDialog from "./manage-loan-dialog/recover-collateral";
import RepayOrExtendLoanDialog from "./manage-loan-dialog/repay-or-extend-loan-dialog";
import {
  Contract,
  ContractStatus,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { Button } from "@frontend/shadcn";
import { LoanAssetHelper } from "@frontend/ui-shared";
import { useWallet } from "@frontend/browser-wallet";
import { AddFiatDetailsDialog } from "@frontend/ui-shared";
import { toast } from "sonner";

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
  let button = undefined;
  const { putFiatDetails } = useHttpClientBorrower();
  const { encryptFiatLoanDetailsBorrower } = useWallet();

  const buttonDisabled =
    contract?.status === ContractStatus.DisputeLenderStarted ||
    contract?.status === ContractStatus.DisputeBorrowerStarted;
  if (!contract) {
    button = undefined;
  } else if (contract.status === ContractStatus.Approved) {
    if (
      contract &&
      LoanAssetHelper.isFiat(contract?.loan_asset) &&
      !contract?.fiat_loan_details_borrower
    ) {
      button = (
        <AddFiatDetailsDialog
          onComplete={async (data) => {
            const fiatLoanDetails = await encryptFiatLoanDetailsBorrower(
              data,
              contract.borrower_pk,
              contract.lender_pk,
            );
            await putFiatDetails(contract.id, fiatLoanDetails);
            toast.success("Fiat Details Updated");
            refreshContract();
          }}
        >
          <Button
            size="default"
            className="-px-4 w-full"
            disabled={buttonDisabled}
          >
            Provide bank details
          </Button>
        </AddFiatDetailsDialog>
      );
    } else {
      button = (
        <AddCollateralDialog isInitialFunding={true} contract={contract}>
          <Button type={"button"} disabled={buttonDisabled}>
            Fund Contract
          </Button>
        </AddCollateralDialog>
      );
    }
  } else if (contract.status === ContractStatus.Requested) {
    button = (
      <CancelRequestDialog contractId={contract.id}>
        <Button type={"button"} variant="destructive" disabled={buttonDisabled}>
          <LuBan className="mr-1 h-4 w-4" />
          Cancel Request
        </Button>
      </CancelRequestDialog>
    );
  } else if (contract.status === ContractStatus.RepaymentConfirmed) {
    button = (
      <WithdrawCollateralDialog
        contract={contract}
        collateralAmountSats={contract.collateral_sats}
        collateralAddress={contract.borrower_btc_address}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          <LuDownload className="mr-2 h-4 w-4" />
          Withdraw Collateral
        </Button>
      </WithdrawCollateralDialog>
    );
  } else if (contract.status === ContractStatus.CollateralRecoverable) {
    button = (
      <RecoverCollateralDialog
        contract={contract}
        collateralAmountSats={contract.collateral_sats}
        collateralAddress={contract.borrower_btc_address}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          <LuDownload className="mr-2 h-4 w-4" />
          Recover Collateral
        </Button>
      </RecoverCollateralDialog>
    );
  } else if (contract.status === ContractStatus.PrincipalGiven) {
    button = (
      <RepayOrExtendLoanDialog
        contract={contract}
        refreshContract={refreshContract}
      >
        <Button type={"button"} disabled={buttonDisabled}>
          Manage Loan <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </RepayOrExtendLoanDialog>
    );
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
