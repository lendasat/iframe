import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Skeleton,
} from "@frontend/shadcn";
import { Contract } from "@frontend/http-client-lender";
import { formatCurrency, LoanAssetHelper } from "@frontend/ui-shared";
import { StablecoinPayout } from "./stablecoin-payout";
import { FiatPayout } from "./fiat-payout";
import { LuCheck, LuClipboard } from "react-icons/lu";

const shortenUuid = (uuid?: string) => {
  if (!uuid) {
    return undefined;
  }
  const firstSix = uuid.slice(0, 6);
  const lastFour = uuid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

interface PayoutPrincipleDialogProps {
  children: React.ReactNode;
  contract?: Contract;
  refreshContract: () => void;
}

const PayoutPrincipleDialog = ({
  children,
  contract,
  refreshContract,
}: PayoutPrincipleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const contractId = contract?.id;

  const loanAmount = contract?.loan_amount;

  const onCopiedAmount = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payout Principle</DialogTitle>
          <DialogDescription>
            Contract ID: {shortenUuid(contractId)}
          </DialogDescription>
        </DialogHeader>

        <>
          <div className="space-y-2">
            <div className="flex flex-row items-center gap-2">
              <Label>Principal Amount:</Label>
              {loanAmount ? (
                <p className="text-lg font-bold my-0">
                  {formatCurrency(loanAmount)}
                </p>
              ) : (
                <Skeleton className="h-4 w-[150px]" />
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={
                  loanAmount
                    ? () => onCopiedAmount(loanAmount?.toString())
                    : undefined
                }
                disabled={!loanAmount}
              >
                {copiedAmount ? (
                  <LuCheck className="h-4 w-4" />
                ) : (
                  <LuClipboard className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {contract?.loan_asset &&
            LoanAssetHelper.isStableCoin(contract.loan_asset) && (
              <StablecoinPayout
                contract={contract}
                refreshContract={refreshContract}
              />
            )}
          {contract?.loan_asset &&
            LoanAssetHelper.isFiat(contract.loan_asset) && (
              <FiatPayout
                contract={contract}
                refreshContract={refreshContract}
              />
            )}
        </>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PayoutPrincipleDialog;
