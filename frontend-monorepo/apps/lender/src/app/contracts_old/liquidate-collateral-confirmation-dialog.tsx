import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import { LuInfo } from "react-icons/lu";
import type { SignedTransaction } from "browser-wallet";

const formatAddress = (address: string) => {
  if (!address || address.length <= 9) {
    return address;
  }

  const first5 = address.substring(0, 5);
  const last4 = address.substring(address.length - 4);

  return `${first5}...${last4}`;
};

type ConfirmLiquidationDialogProps = {
  show: boolean;
  handleClose: () => void;
  handleConfirm: () => void;
  liquidationTx: SignedTransaction;
};

export const ConfirmLiquidationDialog = ({
  show,
  handleClose,
  handleConfirm,
  liquidationTx,
}: ConfirmLiquidationDialogProps) => {
  const formatter = new Intl.NumberFormat("en-US");

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xs sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold md:text-2xl lg:text-4xl mb-7">
            Confirm Liquidation
          </DialogTitle>
        </DialogHeader>
        <div className="mb-3">
          <div className="flex flex-col gap-3">
            <Alert variant="default" className="flex items-baseline gap-2">
              <LuInfo className="h-4 w-4" />
              <AlertDescription>
                Please verify that the liquidation transaction pays the expected
                amount to your chosen address.
              </AlertDescription>
            </Alert>
          </div>
        </div>
        <div className="mb-3">
          <div className="dark:text-font-dark flex flex-col gap-3">
            <p>Sending:</p>
            <ul className="list-inside list-disc pl-5">
              {liquidationTx.outputs.map((o) => (
                <li
                  key={`${o.address}_${o.value}`}
                  className="overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <strong>{formatter.format(o.value)}</strong> sats to{" "}
                  <em>{formatAddress(o.address)}</em>.
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center">
          <Button className="h-12 w-full max-w-md" onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
