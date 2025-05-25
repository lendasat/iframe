import { ReactNode, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import { shortenUuid } from "../details";
import { Contract, useLenderHttpClient } from "@frontend/http-client-lender";
import { X } from "lucide-react";
import { FiatDetailsForm, LoanAssetHelper } from "@frontend/ui-shared";
import { useWallet } from "@frontend/browser-wallet";
import {
  FiatLoanDetails,
  InnerFiatLoanDetails,
} from "@frontend/base-http-client";
import { toast } from "sonner";

interface ApproveOrRejectFiatDialogProps {
  children: ReactNode;
  contract: Contract;
  refreshContract: () => void;
}

const ApproveOrRejectFiatDialog = ({
  children,
  contract,
  refreshContract,
}: ApproveOrRejectFiatDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [rejectError, setRejectError] = useState<string | undefined>();
  const [approveError, setApproveError] = useState<string | undefined>();
  const { approveContract, rejectContract } = useLenderHttpClient();
  const { encryptFiatLoanDetailsLender } = useWallet();

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
      toast.success("Contract has been rejected");
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

  // 2. Define a submit handler.
  async function onSubmit(values: InnerFiatLoanDetails) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.

    setApproveError(undefined);
    setIsAccepting(true);

    let fiatLoanDetails: FiatLoanDetails;
    try {
      fiatLoanDetails = await encryptFiatLoanDetailsLender(
        values,
        contract.lender_pk,
        contract.borrower_pk,
      );
    } catch (error) {
      console.log(`Failed encrypting fiat details ${error}`);
      toast.error("Failed encrypting fiat details");
      setApproveError(
        error instanceof Error
          ? error.message
          : "Failed to encrypt fiat details. Please try again.",
      );
      throw error;
    } finally {
      setIsAccepting(false);
    }

    try {
      await approveContract(contractId, fiatLoanDetails);
      setOpen(false);
      refreshContract();
      toast.success("Contract has been approved");
    } catch (error) {
      console.error("Failed to approve request:", error);
      setApproveError(
        error instanceof Error
          ? error.message
          : "Failed to approve request. Please try again.",
      );
      toast.error("Failed to approve request. Please try again.");
      throw error;
    } finally {
      setIsAccepting(false);
    }
  }

  const shortContractId = contractId ? shortenUuid(contractId) : undefined;

  return (
    <div className="flex gap-2 md:justify-end justify-center">
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
      <Button
        type={"button"}
        variant="destructive"
        disabled={isRejecting}
        onClick={handleReject}
      >
        <X className="h-4 w-4" />
        Reject Request
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>{children}</DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve or Reject Request</DialogTitle>
            {shortContractId && (
              <DialogDescription>ID: {shortContractId}</DialogDescription>
            )}
            <DialogDescription>
              If you approve this request, please have the principal of $
              {loanAmount} in {LoanAssetHelper.print(loanAsset)} ready for
              disbursement. The loan will run for {durationDays} days{" "}
              {interestAmount !== undefined
                ? `and will earn you $${interestAmount} of interests.`
                : ""}
              {isKycLoan &&
                " The borrower also filled out the KYC details. This is handled outside of our system at the moment. Please make sure to verify. By approving this loan, you also approve their KYC details. "}
            </DialogDescription>
          </DialogHeader>
          <FiatDetailsForm
            onSubmit={async (data) => {
              await onSubmit(data);
            }}
            isSubmitting={isAccepting}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApproveOrRejectFiatDialog;
