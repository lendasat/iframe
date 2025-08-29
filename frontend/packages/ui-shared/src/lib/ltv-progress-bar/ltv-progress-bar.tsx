import type { FC } from "react";
import { usePriceForCurrency } from "../price-context";
import { calculateLtv } from "../calculate-ltv";
import { Progress, Skeleton } from "@frontend/shadcn";
import { LoanAsset, LoanAssetHelper } from "../models";

interface LtvProgressBarNewProps {
  balanceOutstanding?: number;
  collateralSats?: number;
  loanAsset?: LoanAsset;
}

export const LtvProgressBar: FC<LtvProgressBarNewProps> = ({
  balanceOutstanding,
  collateralSats,
  loanAsset,
}) => {
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(loanAsset),
  );

  const tmpLtvRation = calculateLtv(
    balanceOutstanding,
    latestPrice,
    collateralSats,
  );
  const ltvRatio = tmpLtvRation ? tmpLtvRation * 100 : undefined;

  // If the price is undefined
  const isNan = ltvRatio === undefined || Number.isNaN(ltvRatio);

  const formattedValue = ltvRatio?.toFixed(1);

  return (
    <div className="flex w-full min-w-[80px] items-center gap-0">
      {isNan ? (
        <Skeleton className="h-4 w-full" />
      ) : (
        <>
          <Progress value={ltvRatio} className={"hidden md:block"} />
          <div className="text-font dark:text-font-dark flex w-full items-center justify-center text-right text-xs font-medium">
            {formattedValue}%
          </div>
        </>
      )}
    </div>
  );
};
