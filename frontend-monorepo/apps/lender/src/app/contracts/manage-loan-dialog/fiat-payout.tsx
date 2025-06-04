import { useState } from "react";
import { LuInfo, LuLoader } from "react-icons/lu";
import { Contract, useLenderHttpClient } from "@frontend/http-client-lender";
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

interface FiatPayoutProps {
  contract: Contract;
  refreshContract: () => void;
}

export function FiatPayout({ contract, refreshContract }: FiatPayoutProps) {
  const [paymentError, setPaymentError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferDescription, setTransferDescription] = useState<string>("");

  const { principalGiven } = useLenderHttpClient();

  const totalPaymentAmount = contract.loan_amount;

  const assetCoin = contract.loan_asset
    ? LoanAssetHelper.toCoin(contract.loan_asset)
    : undefined;

  const handleConfirmPayment = async () => {
    if (!contract.id) {
      // shouldn't happen, but if, we can't proceed without.
      return;
    }
    setPaymentError(undefined);

    if (!transferDescription || transferDescription.trim() === "") {
      setPaymentError("Please enter a valid description");
      return;
    }

    try {
      setIsSubmitting(true);
      await principalGiven(contract.id, transferDescription);

      refreshContract();
    } catch (error) {
      // Handle the error
      console.error("Failed to confirm payment:", error);

      // Determine error message based on the error
      let errorMessage = "Failed to confirm payment. Please try again.";

      if (error instanceof Error) {
        // You can parse specific API errors here if needed
        // For example: if (error.message.includes("invalid transaction")) {...}
        errorMessage = error.message;
      }

      setPaymentError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Alert>
        <LuInfo className="h-4 w-4" />
        <AlertTitle>Payment Instructions</AlertTitle>
        <AlertDescription>
          {totalPaymentAmount ? (
            <>
              Send the exact amount of{" "}
              <strong>{formatCurrency(totalPaymentAmount)}</strong>{" "}
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
          fiatLoanDetails={contract.fiat_loan_details_borrower}
          ownDerivationPath={contract.lender_derivation_path}
        />
      </div>

      {/* Transaction ID input section */}
      <div className="space-y-2 pt-4 border-t mt-4">
        <h3 className="font-medium">Confirm Your Payment</h3>
        <p className="text-sm text-muted-foreground">
          After sending your payment, please enter the description you provided
          when doing the transfer below to confirm your payment.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await handleConfirmPayment();
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
              className={`font-mono text-sm ${paymentError ? "border-red-500" : ""}`}
              disabled={isSubmitting}
              required
            />
            {paymentError && (
              <p className="text-sm font-medium text-red-500">{paymentError}</p>
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
              "Confirm Payout"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
