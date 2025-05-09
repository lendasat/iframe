import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuInfo, LuLoader } from "react-icons/lu";
import {
  Contract,
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
}

export function FiatRepayment({ contract }: FiatRepaymentProps) {
  const [repaymentError, setRepaymentError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferDescription, setTransferDescription] = useState<string>("");

  const { markAsRepaymentProvided } = useHttpClientBorrower();
  const navigate = useNavigate();

  const loanAmount = contract?.loan_amount;
  const loanInterest = contract?.interest;
  const totalRepaymentAmount =
    loanAmount != undefined && loanInterest != undefined
      ? loanAmount + loanInterest
      : undefined;

  const assetCoin = contract?.loan_asset
    ? LoanAssetHelper.toCoin(contract.loan_asset)
    : undefined;

  const handleConfirmRepayment = async () => {
    if (!contract?.id) {
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
      await markAsRepaymentProvided(contract.id, transferDescription);

      // TODO: ideally we wouldn't have todo this... but it's the best we can do to refresh the page
      navigate(0);
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
              <strong>{formatCurrency(totalRepaymentAmount)}</strong>{" "}
              <strong>{assetCoin}</strong> to the bank account below. You can
              withdraw your collateral once the payment is confirmed.
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
      <div className="space-y-2 pt-4 border-t mt-4">
        <h3 className="font-medium">Confirm Your Payment</h3>
        <p className="text-sm text-muted-foreground">
          After sending your payment, please enter the description you provided
          when doing the transfer below to confirm your repayment.
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
              "Confirm Repayment"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
