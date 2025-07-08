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
import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { useNavigate } from "react-router-dom";

interface CancelRequestDialogProps {
  children: ReactNode;
  contractId?: string;
}

const CancelRequestDialog = ({
  children,
  contractId,
}: CancelRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>();
  const { cancelContractRequest } = useHttpClientBorrower();
  const navigate = useNavigate();

  const handleCancel = async () => {
    if (!contractId) {
      // needs to be checked
      return;
    }
    setCancelError(undefined);
    setIsSubmitting(true);

    try {
      await cancelContractRequest(contractId);
      setOpen(false);
      navigate(0);
    } catch (error) {
      console.error("Failed to cancel request:", error);
      setCancelError(
        error instanceof Error
          ? error.message
          : "Failed to cancel request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortContractId = contractId ? shortenUuid(contractId) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Request</DialogTitle>
          {shortContractId && (
            <DialogDescription>ID: {shortContractId}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          <Alert variant="destructive">
            <LuTriangleAlert className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Are you sure you want to cancel this request?
            </AlertDescription>
          </Alert>

          {cancelError && (
            <div className="mt-4 p-2 bg-red-50 text-red-600 rounded-md">
              <p className="text-sm">{cancelError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Processing..."
            ) : (
              <>
                <LuX className="mr-2 h-4 w-4" />
                Cancel Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelRequestDialog;
