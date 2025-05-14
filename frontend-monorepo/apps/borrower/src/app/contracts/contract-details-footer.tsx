import TransactionHistoryDialog from "./transaction-history";
import AddCollateralDialog from "./add-collateral-dialog";
import CancelRequestDialog from "./cancel-request-dialog";
import { LuBan, LuChevronRight, LuDownload } from "react-icons/lu";
import WithdrawCollateralDialog from "./manage-loan-dialog/withdraw-collateral";
import ManageLoanDialog from "./manage-loan-dialog/manage-loan-dialog";
import {
  Contract,
  ContractStatus,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { Button } from "@frontend/shadcn";
import { LoanAssetHelper } from "@frontend/ui-shared";
import AddFiatDetailsDialog from "./manage-loan-dialog/add-fiat-details-dialog";
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

  console.log(
    `contract?.fiat_loan_details_borrower ${contract?.fiat_loan_details_borrower}`,
  );
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
          borrowerPk={contract?.borrower_pk}
          lenderPk={contract?.lender_pk}
          onComplete={async (data) => {
            try {
              await putFiatDetails(contract?.id, data);
              toast.success("Fiat Details Updated");
              refreshContract();
            } catch (error) {
              console.log(`Failed updating fiat details ${error}`);
              toast.error(`Failed updating fiat details ${error}`);
            }
          }}
        >
          <Button type={"button"} disabled={buttonDisabled}>
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
  } else if (
    contract.status !== ContractStatus.Cancelled &&
    contract.status !== ContractStatus.Closed &&
    contract.status !== ContractStatus.RepaymentProvided &&
    contract.status !== ContractStatus.Extended &&
    contract.status !== ContractStatus.CollateralConfirmed &&
    contract.status !== ContractStatus.Undercollateralized &&
    contract.status !== ContractStatus.CollateralSeen
  ) {
    button = (
      <ManageLoanDialog contract={contract}>
        <Button type={"button"} disabled={buttonDisabled}>
          Manage Loan <LuChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </ManageLoanDialog>
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
