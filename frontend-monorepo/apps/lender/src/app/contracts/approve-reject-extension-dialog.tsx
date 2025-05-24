import { ReactNode, useState } from "react";
import { LuTriangleAlert, LuX } from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { shortenUuid } from "./details";
import { useLenderHttpClient } from "@frontend/http-client-lender";
import { Check } from "lucide-react";
import { format } from "date-fns";

interface ApproveOrRejectExtensionDialogProps {
  children: ReactNode;
  contractId: string;
  interestAmount: number;
  expiry: Date;
  refreshContract: () => void;
}

const ApproveOrRejectExtensionDialog = ({
  children,
  contractId,
  interestAmount,
  expiry,
  refreshContract,
}: ApproveOrRejectExtensionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [rejectError, setRejectError] = useState<string | undefined>();
  const [approveError, setApproveError] = useState<string | undefined>();
  const { rejectContractExtension, approveContract } = useLenderHttpClient();

  const handleReject = async () => {
    if (!contractId) {
      // needs to be checked
      return;
    }
    setRejectError(undefined);
    setIsRejecting(true);

    try {
      await rejectContractExtension(contractId);
      setOpen(false);
      refreshContract();
    } catch (error) {
      console.error("Failed to reject request:", error);
      setRejectError(
        error instanceof Error
          ? error.message
          : "Failed to reject request. Please try again.",
      );
    } finally {
      setIsRejecting(false);
    }
  };

  const handleApprove = async () => {
    if (!contractId) {
      // needs to be checked
      return;
    }
    setApproveError(undefined);
    setIsAccepting(true);

    try {
      await approveContract(contractId);
      setOpen(false);
      refreshContract();
    } catch (error) {
      console.error("Failed to approve request:", error);
      setApproveError(
        error instanceof Error
          ? error.message
          : "Failed to approve request. Please try again.",
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const shortContractId = contractId ? shortenUuid(contractId) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve or Reject Request</DialogTitle>
          {shortContractId && (
            <DialogDescription>ID: {shortContractId}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          <Alert variant="default">
            <LuTriangleAlert className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              The borrower wants to extend the loan until{" "}
              {format(expiry, "MMM, dd yyyy")}.
              {interestAmount !== undefined
                ? ` You will earn a total of $${interestAmount} of interests if you approve.`
                : ""}
            </AlertDescription>
          </Alert>

          {rejectError && (
            <div className="mt-4 p-2 bg-red-50 text-red-600 rounded-md">
              <p className="text-sm">{rejectError}</p>
            </div>
          )}
          {approveError && (
            <div className="mt-4 p-2 bg-red-50 text-red-600 rounded-md">
              <p className="text-sm">{approveError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isRejecting}
          >
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isRejecting}
          >
            {isRejecting ? (
              "Processing..."
            ) : (
              <>
                <LuX className="mr-2 h-4 w-4" />
                Cancel Request
              </>
            )}
          </Button>
          <Button
            variant="default"
            onClick={handleApprove}
            disabled={isAccepting}
          >
            {isAccepting ? (
              "Processing..."
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApproveOrRejectExtensionDialog;
