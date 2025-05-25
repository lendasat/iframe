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
import { shortenUuid } from "../details";
import { Contract, useLenderHttpClient } from "@frontend/http-client-lender";
import { Check } from "lucide-react";
import { LoanAssetHelper } from "@frontend/ui-shared";
import { toast } from "sonner";

interface CancelRequestDialogProps {
  children: ReactNode;
  contract: Contract;
  refreshContract: () => void;
}

const ApproveOrRejectStablesDialog = ({
  children,
  contract,
  refreshContract,
}: CancelRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [rejectError, setRejectError] = useState<string | undefined>();
  const [approveError, setApproveError] = useState<string | undefined>();
  const { approveContract, rejectContract } = useLenderHttpClient();

  const contractId = contract.id;
  const loanAmount = contract.loan_amount;
  const interestAmount = contract.interest;
  const durationDays = contract.duration_days;
  const loanAsset = contract.loan_asset;
  const isKycLoan =
    contract.kyc_info?.kyc_link && contract.kyc_info.kyc_link?.length > 0;

  const handleReject = async () => {
    if (!contractId) {
      // needs to be checked
      return;
    }
    setRejectError(undefined);
    setIsRejecting(true);

    try {
      await rejectContract(contractId);
      setOpen(false);
      refreshContract();
      toast.success("Contract rejected");
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
      toast.success("Contract approved");
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
      <DialogTrigger asChild>{children}</DialogTrigger>
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
              If you approve this request, please have the principal of $
              {loanAmount} in {LoanAssetHelper.print(loanAsset)} ready for
              disbursement. The loan will run for {durationDays} days{" "}
              {interestAmount !== undefined
                ? `and will earn you $${interestAmount} of interests.`
                : ""}
              {isKycLoan &&
                " The borrower also filled out the KYC details. This is handled outside of our system at the moment. Please make sure to verify. By approving this loan, you also approve his KYC details."}
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
                Reject
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
                Approve
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApproveOrRejectStablesDialog;
