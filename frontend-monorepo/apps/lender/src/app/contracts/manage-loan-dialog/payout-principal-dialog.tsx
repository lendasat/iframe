import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  Label,
  Skeleton,
} from "@frontend/shadcn";
import { Contract } from "@frontend/http-client-lender";
import { formatCurrency, LoanAssetHelper } from "@frontend/ui-shared";
import { StablecoinPayout } from "./stablecoin-payout";
import { FiatPayout } from "./fiat-payout";
import { LuCheck, LuClipboard } from "react-icons/lu";

interface PayoutPrincipalDialogProps {
  children: React.ReactNode;
  contract?: Contract;
  refreshContract: () => void;
}

const PayoutPrincipalDialog = ({
  children,
  contract,
  refreshContract,
}: PayoutPrincipalDialogProps) => {
  const [open, setOpen] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <FiatPayout contract={contract} refreshContract={refreshContract} />
          )}
      </DialogContent>
    </Dialog>
  );
};

export default PayoutPrincipalDialog;
