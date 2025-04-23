import { ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import { Textarea } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useBorrowerHttpClient } from "@frontend/http-client-borrower";

interface DisputeDialogProps {
  contractId: string;
  children: ReactNode; // Custom trigger element
}

const disputeReasons = [
  "Payment issue: Did not receive loan amount",
  "Repayment issue: Did not receive back collateral",
  "Other",
];

const StartDisputeDialog = ({ contractId, children }: DisputeDialogProps) => {
  const { startDispute } = useBorrowerHttpClient();

  const [disputeReason, setDisputeReason] = useState(disputeReasons[0]);
  const [disputeDetails, setDisputeDetails] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null); // Clear any previous error message
      await startDispute(contractId, disputeReason, disputeDetails);
      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Error submitting dispute:", error);
      setErrorMessage(error?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    console.log(`Open change: ${open}`);
    setIsOpen(open);
    if (open) {
      setErrorMessage(null); // Clear error message when dialog is opened
    } else if (!isSubmitted) {
      resetForm(); // Only reset form if closed and not submitted
    }
  };

  const resetForm = () => {
    setDisputeReason("other");
    setDisputeDetails("");
    setIsSubmitted(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    console.log("close dispute");
    setIsOpen(false);
    resetForm();
  };

  return (
    <div>
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
        <AlertDialogContent className="sm:max-w-md">
          {!isSubmitted ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Submit a Dispute
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Please provide details about your dispute. We'll review your
                  case and reach out via email as soon as possible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="dispute-reason">Reason for dispute</Label>
                  <Select
                    value={disputeReason}
                    onValueChange={setDisputeReason}
                  >
                    <SelectTrigger id="dispute-reason">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {disputeReasons.map((d) => {
                        return (
                          <SelectItem value={d} key={d}>
                            {d}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dispute-details">Details</Label>
                  <Textarea
                    id="dispute-details"
                    placeholder="Please provide information about your dispute"
                    value={disputeDetails}
                    onChange={(e) => setDisputeDetails(e.target.value)}
                    className="min-h-32"
                  />
                </div>
                {errorMessage && (
                  <div className="rounded-md bg-red-100 p-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <h3 className="text-sm font-medium text-red-800">
                        Error submitting dispute
                      </h3>
                    </div>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{errorMessage}</p>
                    </div>
                  </div>
                )}
              </div>
              <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
                <AlertDialogCancel onClick={() => setIsOpen(false)}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  disabled={!disputeDetails || isSubmitting}
                  onClick={handleSubmit}
                  className="bg-red-500 hover:bg-red-600"
                >
                  {isSubmitting ? "Submitting..." : "Submit Dispute"}
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Dispute Submitted
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Thank you for submitting your dispute. Our team will review
                  your case and respond within 24 hours.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={handleClose}>
                  Close
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StartDisputeDialog;
