import React, { useState } from "react";
import {
  LuQrCode,
  LuClipboard,
  LuCheck,
  LuExternalLink,
  LuInfo,
  LuCircleAlert,
  LuCalendarClock,
  LuLoader,
} from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Skeleton,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { RadioGroup, RadioGroupItem } from "@frontend/shadcn";
import {
  Contract,
  useBorrowerHttpClient,
} from "@frontend/http-client-borrower";
import { format } from "date-fns";
import {
  formatCurrency,
  getAddressUrl,
  getTxUrl,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import QRCode from "qrcode.react";
import { useNavigate } from "react-router-dom";

const shortenUuid = (uuid?: string) => {
  if (!uuid) {
    return undefined;
  }
  const firstSix = uuid.slice(0, 6);
  const lastFour = uuid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

interface ManageLoanDialogProps {
  children: React.ReactNode;
  contract?: Contract;
}

const ManageLoanDialog = ({ children, contract }: ManageLoanDialogProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("repay");
  const [extensionMonths, setExtensionMonths] = useState<string>("1");
  const [copied, setCopied] = useState(false);
  const [transactionId, setTransactionId] = useState<string>("");
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const { markAsRepaymentProvided } = useBorrowerHttpClient();

  const currentExpiryDate = contract?.expiry;
  const repaymentAddress = contract?.loan_repayment_address;
  console.log("repaymentAddress", repaymentAddress);

  const loanAmount = contract?.loan_amount;
  const loanInterest = contract?.interest;
  const totalRepaymentAmount =
    loanAmount && loanInterest ? loanAmount + loanInterest : undefined;

  const contractId = contract?.id;
  // TODO: differentiate between coin and network
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

  const onRequestExtension = (months: number) => {
    // do nothing
  };

  const handleConfirmRepayment = async () => {
    if (!contractId) {
      // shouldn't happen, but if, we can't proceed without.
      return;
    }
    setRepaymentError(null);

    if (transactionId.trim() === "") {
      setRepaymentError("Please enter a valid transaction ID");
      return;
    }

    try {
      setIsSubmitting(true);
      await markAsRepaymentProvided(contractId, transactionId);
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

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return "Unknown";
    return format(date, "MMM, do yyyy - p");
  };

  // Calculate new expiry date
  const calculateNewExpiryDate = () => {
    if (!currentExpiryDate) return "Unknown";

    const newDate = new Date(currentExpiryDate);
    newDate.setMonth(newDate.getMonth() + parseInt(extensionMonths));

    return formatDate(newDate);
  };

  // Handle extension request
  const handleExtensionRequest = () => {
    if (onRequestExtension) {
      onRequestExtension(parseInt(extensionMonths));
    }
    setOpen(false);
  };

  // Handle copy address
  const handleCopyAddress = () => {
    if (repaymentAddress) {
      navigator.clipboard.writeText(repaymentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      onCopyAddress(repaymentAddress);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Loan</DialogTitle>
          <DialogDescription>
            Contract ID: {shortenUuid(contractId)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="repay" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="repay">Repay Loan</TabsTrigger>
            <TabsTrigger value="extend">Request Extension</TabsTrigger>
          </TabsList>

          <TabsContent value="repay" className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="font-medium">Payment Details</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Principal Amount</Label>
                  {loanAmount ? (
                    <p className="text-lg font-bold">
                      {formatCurrency(loanAmount)}
                    </p>
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
                    <strong>{assetCoin}</strong> on{" "}
                    <strong>{assetNetwork}</strong> to the address below. You
                    can withdraw your collateral once the payment is confirmed.
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
                  onClick={handleCopyAddress}
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
                  onClick={handleCopyAddress}
                  disabled={!repaymentAddress}
                >
                  {copied ? (
                    <LuCheck className="h-4 w-4" />
                  ) : (
                    <LuClipboard className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  asChild
                  size={"icon"}
                  variant={"ghost"}
                  className="h-6 w-6"
                >
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
                <strong>{assetNetwork}</strong> network. Sending other tokens or
                using the wrong network may result in loss of funds.
              </AlertDescription>
            </Alert>

            {/* Transaction ID input section */}
            <div className="space-y-2 pt-4 border-t mt-4">
              <h3 className="font-medium">Confirm Your Payment</h3>
              <p className="text-sm text-muted-foreground">
                After sending your payment, please enter the transaction ID
                below to confirm your repayment.
              </p>

              <div className="grid gap-2">
                <Label htmlFor="transaction-id">Transaction ID</Label>
                <Input
                  id="transaction-id"
                  placeholder="Enter your transaction ID"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="font-mono text-sm"
                />
                {repaymentError && (
                  <p className="text-sm font-medium text-red-500">
                    {repaymentError}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="extend" className="space-y-4 py-4">
            <div className="space-y-2">
              <div>
                <Label>Current Expiry Date</Label>
                <p className="text-lg font-bold">
                  {formatDate(currentExpiryDate)}
                </p>
              </div>

              <Alert className="my-4">
                <LuCalendarClock className="h-4 w-4" />
                <AlertTitle>Request Extension</AlertTitle>
                <AlertDescription>
                  You can request to extend your loan term. The lender will need
                  to approve this request, and an extension fee may apply.
                </AlertDescription>
              </Alert>

              <div className="pt-2">
                <Label htmlFor="extension-period" className="block mb-2">
                  Extension Period
                </Label>
                <RadioGroup
                  id="extension-period"
                  value={extensionMonths}
                  onValueChange={setExtensionMonths}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="r1" />
                    <Label htmlFor="r1">1 Month</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3" id="r2" />
                    <Label htmlFor="r2">3 Months</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="6" id="r3" />
                    <Label htmlFor="r3">6 Months</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="pt-4">
                <Label>New Expiry Date (if approved)</Label>
                <p className="text-lg font-bold">{calculateNewExpiryDate()}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>

          {activeTab === "repay" ? (
            <Button
              variant="default"
              onClick={handleConfirmRepayment}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LuLoader className="animate-spin" />
                  Please wait
                </>
              ) : (
                "Confirm Repayment"
              )}
            </Button>
          ) : (
            <Button variant="default" onClick={handleExtensionRequest}>
              Request Extension
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageLoanDialog;
