import type { FC } from "react";
import { usePriceForCurrency } from "../price-context";
import { Progress, Skeleton } from "@frontend/shadcn";
import { LoanAsset, LoanAssetHelper } from "../models";

interface LtvProgressBarNewProps {
  loanAmount: number;
  collateralBtc: number | undefined;
  loanAsset: LoanAsset;
}

export const LtvProgressBar: FC<LtvProgressBarNewProps> = ({
  loanAmount,
  collateralBtc,
  loanAsset,
}) => {
  // TODO: the latest price should probably be passed down for a better performance
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(loanAsset),
  );

  const ltvRatio =
    collateralBtc && latestPrice
      ? (loanAmount / (collateralBtc * latestPrice)) * 100
      : 0;

  // If the price is 0.
  const isNan = Number.isNaN(ltvRatio);

  const formattedValue = ltvRatio.toFixed(0);

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
