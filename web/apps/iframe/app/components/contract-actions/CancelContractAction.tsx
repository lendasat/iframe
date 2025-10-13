import { useState } from "react";
import { useNavigate } from "react-router";
import { apiClient } from "@repo/api";
import { Button } from "~/components/ui/button";
import { ConfirmCancellation } from "./ConfirmCancellation";

interface CancelContractActionProps {
  contractId: string;
}

export function CancelContractAction({
  contractId,
}: CancelContractActionProps) {
  const navigate = useNavigate();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelContract = async () => {
    setIsCancelling(true);
    try {
      await apiClient.cancelContract(contractId);
      setShowCancelDialog(false);
      // Navigate back to contracts list after successful cancellation
      navigate(0);
    } catch (err) {
      console.error("Failed to cancel contract:", err);
      alert("Failed to cancel contract. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowCancelDialog(true)}
        disabled={isCancelling}
        variant="destructive"
        className="w-full"
      >
        {isCancelling ? "Cancelling..." : "Cancel Request"}
      </Button>

      <ConfirmCancellation
        isOpen={showCancelDialog}
        title="Cancel Contract Request"
        message="Are you sure you want to cancel this request?"
        confirmLabel="Yes, Cancel Request"
        cancelLabel="No, Keep Request"
        onConfirm={handleCancelContract}
        onCancel={() => setShowCancelDialog(false)}
        isDestructive={true}
      />
    </>
  );
}
