import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import { InnerFiatLoanDetails } from "@frontend/base-http-client";
import { FiatDetailsForm } from "./add-fiat-details-form";

interface AddFiatDetailsDialogProps {
  children: ReactNode;
  onComplete: (data: InnerFiatLoanDetails) => void;
}

export const AddFiatDetailsDialog = ({
  children,
  onComplete,
}: AddFiatDetailsDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fiat Transfer Details</DialogTitle>
          <DialogDescription>
            Please provide the necessary details for your fiat transfer. Your
            details are encrypted and will be securely stored.
          </DialogDescription>
        </DialogHeader>
        <FiatDetailsForm
          onSubmit={(data) => {
            onComplete(data);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AddFiatDetailsDialog;
