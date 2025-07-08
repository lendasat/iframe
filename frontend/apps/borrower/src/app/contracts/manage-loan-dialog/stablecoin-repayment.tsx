import { useState } from "react";
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
import {
  Contract,
  Installment,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  formatCurrency,
  getAddressUrl,
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

interface StablecoinRepaymentProps {
  contract?: Contract;
  installment?: Installment;
  refreshContract: () => void;
  onSubmit: () => void;
}

export function StablecoinRepayment({
  contract,
  installment,
  refreshContract,
  onSubmit,
}: StablecoinRepaymentProps) {
  const [copied, setCopied] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string>("");

  const { markInstallmentAsPaid } = useHttpClientBorrower();

  const principalAmount = Number(installment?.principal) || 0;
  const interestAmount = Number(installment?.interest) || 0;
  const totalRepaymentAmount =
    installment?.principal !== undefined && installment?.interest !== undefined
      ? principalAmount + interestAmount
      : undefined;

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
    if (!contract?.id || !installment?.id) {
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
      await markInstallmentAsPaid(contract.id, installment.id, transactionId);
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
              <strong>{assetCoin}</strong> on <strong>{assetNetwork}</strong> to
              the address below.
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

      <div className="my-4 flex justify-center">
        <div
          className={`rounded-lg border bg-white p-4 shadow-sm ${repaymentAddress ? "cursor-copy hover:bg-gray-50" : ""} transition-colors`}
          onClick={
            repaymentAddress ? () => onCopyAddress(repaymentAddress) : undefined
          }
        >
          {repaymentAddress ? (
            <QRCode value={repaymentAddress} size={150} />
          ) : (
            <LuQrCode className="h-40 w-40" />
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center space-x-2">
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
            repaymentAddress ? () => onCopyAddress(repaymentAddress) : undefined
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
      <div className="mt-4 space-y-2 border-t pt-4">
        <h3 className="font-medium">Confirm Your Payment</h3>
        <p className="text-muted-foreground text-sm">
          After completing your payment, please provide the transaction ID for
          confirmation.
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
              "Confirm Payment"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
