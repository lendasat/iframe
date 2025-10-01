import { LoanOffer } from "@frontend/http-client-borrower";
import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";

interface KycDialogProps {
  selectedOffer: LoanOffer;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
}

export function KycDialog({
  selectedOffer,
  checked,
  onCheckedChange,
  onConfirm,
}: KycDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default" className="mt-3">
          KYC Form
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[450px]">
        <DialogHeader>
          <DialogTitle>KYC Required</DialogTitle>
          <DialogDescription className="space-y-4 pt-4">
            <p>
              For this offer KYC is required. KYC verification is performed by
              the lender and we do not know if you have processed or succeeded
              KYC with them in the past.
            </p>

            <div className="flex justify-center py-4">
              <a
                href={selectedOffer?.kyc_link}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline hover:text-primary/80"
              >
                Access KYC Form →
              </a>
            </div>

            <p>
              If this is your first time requesting from this lender, please
              proceed to their KYC form to initiate the procedure.
            </p>

            <p>
              Meanwhile, you can continue requesting the offer through Lendasat.
              Once the KYC request has been approved, the Lender will accept
              your loan request.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-4">
          <Checkbox
            checked={checked}
            onCheckedChange={onCheckedChange}
            id="kyc-confirm"
          />
          <label htmlFor="kyc-confirm" className="text-sm">
            I confirm I've submitted the KYC
          </label>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button disabled={!checked} onClick={onConfirm}>
              Confirm
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
