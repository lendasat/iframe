import {
  LuCheck,
  LuCircleAlert,
  LuClipboard,
  LuExternalLink,
  LuInfo,
  LuLoader,
  LuQrCode,
} from "react-icons/lu";
import QRCode from "qrcode.react";
import React, { useState } from "react";
import {
  Contract,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Skeleton,
} from "@frontend/shadcn";
import {
  formatCurrency,
  getAddressUrl,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { useNavigate } from "react-router-dom";

interface RepaymentProps {
  contract?: Contract;
}

export function Repayment({ contract }: RepaymentProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string>("");

  const { markAsRepaymentProvided } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const loanAmount = contract?.loan_amount;
  const loanInterest = contract?.interest;
  const totalRepaymentAmount =
    loanAmount && loanInterest ? loanAmount + loanInterest : undefined;

  const repaymentAddress = contract?.loan_repayment_address;

  const assetCoin = contract?.loan_asset
    ? LoanAssetHelper.toCoin(contract.loan_asset)
    : undefined;
  const assetNetwork = contract?.loan_asset
    ? LoanAssetHelper.toChain(contract.loan_asset)
    : undefined;
  const contractUrl = getAddressUrl(repaymentAddress, contract?.loan_asset);

  const onCopyAddress = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleConfirmRepayment = async () => {
    if (!contract?.id) {
      // shouldn't happen, but if, we can't proceed without.
      return;
    }
    setRepaymentError(undefined);

    if (!transactionId || transactionId.trim() === "") {
      setRepaymentError("Please enter a valid transaction ID");
      return;
    }

    try {
      setIsSubmitting(true);
      await markAsRepaymentProvided(contract.id, transactionId);
      setOpen(false);

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
    <>
      <div className="space-y-2">
        <h3 className="font-medium">Payment Details</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Principal Amount</Label>
            {loanAmount ? (
              <p className="text-lg font-bold">{formatCurrency(loanAmount)}</p>
            ) : (
              <Skeleton className="h-4 w-[150px]" />
            )}
          </div>
          <div>
            <Label>Interest</Label>
            {loanInterest ? (
              <p className="text-lg font-bold">
                {formatCurrency(loanInterest)}
              </p>
            ) : (
              <Skeleton className="h-4 w-[150px]" />
            )}
          </div>
        </div>
        <div className="pt-2 border-t mt-2">
          <Label>Total Payment</Label>
          {totalRepaymentAmount ? (
            <p className="text-xl font-bold">
              {formatCurrency(totalRepaymentAmount)} {assetCoin}
            </p>
          ) : (
            <Skeleton className="h-4 w-[150px]" />
          )}
        </div>
      </div>

      <Alert>
        <LuInfo className="h-4 w-4" />
        <AlertTitle>Repayment Instructions</AlertTitle>
        <AlertDescription>
          {totalRepaymentAmount ? (
            <>
              Send the exact amount of{" "}
              <strong>{formatCurrency(totalRepaymentAmount)}</strong>{" "}
              <strong>{assetCoin}</strong> on <strong>{assetNetwork}</strong> to
              the address below. You can withdraw your collateral once the
              payment is confirmed.
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

      <>
        <div className="flex justify-center my-4">
          <div
            className={`bg-white p-4 rounded-lg border shadow-sm  ${repaymentAddress ? "cursor-copy hover:bg-gray-50" : ""} transition-colors`}
            onClick={
              repaymentAddress
                ? () => onCopyAddress(repaymentAddress)
                : undefined
            }
          >
            {repaymentAddress ? (
              <QRCode value={repaymentAddress} size={150} />
            ) : (
              <>
                <LuQrCode className="h-40 w-40" />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="payment-address" className="sr-only">
              Payment Address
            </Label>
            <Input
              id="payment-address"
              value={repaymentAddress}
              readOnly
              className="font-mono text-sm"
              disabled={!repaymentAddress}
            />
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={
              repaymentAddress
                ? () => onCopyAddress(repaymentAddress)
                : undefined
            }
            disabled={!repaymentAddress}
          >
            {copied ? (
              <LuCheck className="h-4 w-4" />
            ) : (
              <LuClipboard className="h-4 w-4" />
            )}
          </Button>
          <Button asChild size={"icon"} variant={"ghost"} className="h-6 w-6">
            <a
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <LuExternalLink className="h-4 w-4" />{" "}
            </a>
          </Button>
        </div>
      </>

      <Alert variant="destructive">
        <LuCircleAlert className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          Make sure to send only <strong>{assetCoin}</strong> on the{" "}
          <strong>{assetNetwork}</strong> network. Sending other tokens or using
          the wrong network may result in loss of funds.
        </AlertDescription>
      </Alert>

      {/* Transaction ID input section */}
      <div className="space-y-2 pt-4 border-t mt-4">
        <h3 className="font-medium">Confirm Your Payment</h3>
        <p className="text-sm text-muted-foreground">
          After sending your payment, please enter the transaction ID below to
          confirm your repayment.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmRepayment();
          }}
          className="space-y-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="transaction-id">Transaction ID</Label>
            <Input
              id="transaction-id"
              placeholder="Enter your transaction ID"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
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
            disabled={!transactionId.trim() || isSubmitting}
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
    </>
  );
}
