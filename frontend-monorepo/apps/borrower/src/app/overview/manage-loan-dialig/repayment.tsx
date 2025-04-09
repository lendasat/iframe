import React from "react";
import { Contract } from "@frontend/http-client-borrower";
import { Label, Skeleton } from "@frontend/shadcn";
import { formatCurrency, LoanAssetHelper } from "@frontend/ui-shared";
import { StablecoinRepayment } from "./stablecoin-repayment";
import { FiatRepayment } from "./fiat-repayment";

interface RepaymentProps {
  contract?: Contract;
}

export function Repayment({ contract }: RepaymentProps) {
  const loanAmount = contract?.loan_amount;
  const loanInterest = contract?.interest;
  const totalRepaymentAmount =
    loanAmount != undefined && loanInterest != undefined
      ? loanAmount + loanInterest
      : undefined;

  const assetCoin = contract?.loan_asset
    ? LoanAssetHelper.toCoin(contract.loan_asset)
    : undefined;

  return (
    <>
      <div className="space-y-2">
        <h3 className="font-medium">Payment Details</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Principal Amount</Label>
            {loanAmount ? (
              <p className="text-lg font-bold">{formatCurrency(loanAmount)}</p>
            ) : (
              <Skeleton className="h-4 w-[150px]" />
            )}
          </div>
          <div>
            <Label>Interest</Label>
            {loanInterest != undefined ? (
              <p className="text-lg font-bold">
                {formatCurrency(loanInterest)}
              </p>
            ) : (
              <Skeleton className="h-4 w-[150px]" />
            )}
          </div>
        </div>
        <div className="pt-2 border-t mt-2">
          <Label>Total Payment</Label>
          {totalRepaymentAmount != undefined ? (
            <p className="text-xl font-bold">
              {formatCurrency(totalRepaymentAmount)} {assetCoin}
            </p>
          ) : (
            <Skeleton className="h-4 w-[150px]" />
          )}
        </div>
      </div>

      {contract?.loan_asset &&
        LoanAssetHelper.isStableCoin(contract.loan_asset) && (
          <StablecoinRepayment contract={contract} />
        )}
      {contract?.loan_asset && LoanAssetHelper.isFiat(contract.loan_asset) && (
        <FiatRepayment contract={contract} />
      )}
    </>
  );
}
