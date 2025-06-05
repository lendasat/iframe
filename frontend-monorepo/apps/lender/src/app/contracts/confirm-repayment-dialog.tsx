import { ReactNode, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import {
  Contract,
  InstallmentStatus,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { AlertCircle, Check } from "lucide-react";
import { LuCheck, LuClipboard, LuExternalLink } from "react-icons/lu";
import { formatCurrency, getTxUrl } from "@frontend/ui-shared";
import { toast } from "sonner";

const shortenTxid = (txid?: string) => {
  if (!txid) {
    return "undefined";
  }
  const firstSix = txid.slice(0, 4);
  const lastFour = txid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

interface ApproveOrRejectExtensionDialogProps {
  children: ReactNode;
  contract: Contract;
  refreshContract: () => void;
}

const RepaymentConfirmationDialog = ({
  children,
  contract,
  refreshContract,
}: ApproveOrRejectExtensionDialogProps) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [txidCopied, setTxidCopied] = useState(false);
  const { markInstallmentAsConfirmed } = useLenderHttpClient();
  const [rejectError, setRejectError] = useState<string | undefined>();

  const paidInstallment = contract.installments
    .filter((installment) => installment.status === InstallmentStatus.Paid)
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    )[0];

  const handleCopyTxid = async (txid: string) => {
    await navigator.clipboard.writeText(txid);
    setTxidCopied(true);
    setTimeout(() => setTxidCopied(false), 2000);
    toast("Copied to clipboard");
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await markInstallmentAsConfirmed(contract.id, paidInstallment.id);
      refreshContract();
    } catch (error) {
      console.error(`Failed confirming installment payment: $error}`);
      setRejectError(
        error instanceof Error
          ? error.message
          : "Failed to confirm installment payment. Please try again.",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const totalAmount =
    Number(paidInstallment.principal) + Number(paidInstallment.interest);

  const transactionId = paidInstallment.payment_id;

  const shortendTxId = shortenTxid(transactionId);
  let url = undefined;

  if (transactionId) {
    url = getTxUrl(transactionId, contract?.loan_asset);
  }

  return (
    <Dialog>
      {/* Dialog Trigger */}
      <DialogTrigger>{children}</DialogTrigger>

      {/* Dialog Content */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Installment Payment</DialogTitle>
          <DialogDescription>
            Please review the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">
                Total Installment Amount:
              </div>
              <div className="font-medium">{formatCurrency(totalAmount)}</div>

              <div className="text-muted-foreground">Transaction ID:</div>
              <div className="flex items-center">
                <p className="text-xs text-gray-600 mt-1 font-mono mr-2">
                  {shortendTxId}
                </p>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6"
                  onClick={() => handleCopyTxid(transactionId || "")}
                >
                  {txidCopied ? (
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
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <LuExternalLink className="h-4 w-4" />{" "}
                  </a>
                </Button>
              </div>
            </div>

            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                If any of the information above appears to be incorrect or if
                you have not received the payment, please initiate a dispute.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <DialogClose>
            <Button variant="outline" disabled={isConfirming}>
              Back
            </Button>
          </DialogClose>

          <Button onClick={handleConfirm}>
            {isConfirming ? (
              "Processing..."
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirm
              </>
            )}
          </Button>
        </DialogFooter>
        {rejectError && (
          <div className="mt-4 p-2 bg-red-50 text-red-600 rounded-md">
            <p className="text-sm">{rejectError}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RepaymentConfirmationDialog;
