import { useState } from "react";
import { LuInfo, LuLoader } from "react-icons/lu";
import {
  Contract,
  Installment,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  BankingDetailsSummary,
  formatCurrency,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Skeleton,
} from "@frontend/shadcn";

interface FiatRepaymentProps {
  contract?: Contract;
  installment?: Installment;
  refreshContract: () => void;
  onSubmit: () => void;
}

export function FiatRepayment({
  contract,
  installment,
  refreshContract,
  onSubmit,
}: FiatRepaymentProps) {
  const [repaymentError, setRepaymentError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferDescription, setTransferDescription] = useState<string>("");

  const { markInstallmentAsPaid } = useHttpClientBorrower();

  const principalAmount = Number(installment?.principal) || 0;
  const interestAmount = Number(installment?.interest) || 0;
  const totalRepaymentAmount =
    installment?.principal !== undefined && installment?.interest !== undefined
      ? principalAmount + interestAmount
      : undefined;

  const assetCoin = contract?.loan_asset
    ? LoanAssetHelper.toCoin(contract.loan_asset)
    : undefined;

  const handleConfirmRepayment = async () => {
    if (!contract?.id || !installment?.id) {
      // shouldn't happen, but if, we can't proceed without.
      return;
    }
    setRepaymentError(undefined);

    if (!transferDescription || transferDescription.trim() === "") {
      setRepaymentError("Please enter a valid description");
      return;
    }

    try {
      setIsSubmitting(true);
      await markInstallmentAsPaid(
        contract.id,
        installment.id,
        transferDescription,
      );
      refreshContract();
      onSubmit();
    } catch (error) {
      // Handle the error
      console.error("Failed to confirm repayment:", error);

      // Determine error message based on the error
      let errorMessage = "Failed to confirm repayment. Please try again.";

      if (error instanceof Error) {
        // You can parse specific API errors here if needed
        // For example: if (error.message.includes("invalid transaction")) {...}
        errorMessage = error.message;
      }

      setRepaymentError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Alert>
        <LuInfo className="h-4 w-4" />
        <AlertTitle>Repayment Instructions</AlertTitle>
        <AlertDescription>
          {totalRepaymentAmount ? (
            <>
              Send the exact amount of{" "}
              <strong>
                {formatCurrency(
                  totalRepaymentAmount,
                  LoanAssetHelper.toCurrency(contract?.loan_asset),
                )}
              </strong>{" "}
              <strong>{assetCoin}</strong> to the bank account below.
            </>
          ) : (
            <>
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[150px]" />
            </>
          )}
        </AlertDescription>
      </Alert>

      <div className={"pt-4"}>
        <BankingDetailsSummary
          fiatLoanDetails={contract?.fiat_loan_details_lender}
          ownDerivationPath={contract?.borrower_derivation_path}
        />
      </div>

      {/* Transaction ID input section */}
      <div className="mt-4 space-y-2 border-t pt-4">
        <h3 className="font-medium">Confirm Your Payment</h3>
        <p className="text-muted-foreground text-sm">
          After completing your payment, please provide the transfer description
          for confirmation.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmRepayment();
          }}
          className="space-y-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="transaction-id">Description</Label>
            <Input
              id="transaction-id"
              placeholder="Enter transfer description"
              value={transferDescription}
              onChange={(e) => setTransferDescription(e.target.value)}
              className={`font-mono text-sm ${repaymentError ? "border-red-500" : ""}`}
              disabled={isSubmitting}
              required
            />
            {repaymentError && (
              <p className="text-sm font-medium text-red-500">
                {repaymentError}
              </p>
            )}
          </div>
          <Button
            variant="default"
            type="submit"
            disabled={!transferDescription.trim() || isSubmitting}
            className="w-full px-0"
          >
            {isSubmitting ? (
              <>
                <LuLoader className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Confirm Payment"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
