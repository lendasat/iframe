import type { FC } from "react";
import { usePrice } from "../price-context";
import { Progress, Skeleton } from "@frontend/shadcn";

interface LtvProgressBarNewProps {
  loanAmount: number;
  collateralBtc: number | undefined;
}

export const LtvProgressBar: FC<LtvProgressBarNewProps> = ({
  loanAmount,
  collateralBtc,
}) => {
  const { latestPrice } = usePrice();

  const ltvRatio = collateralBtc
    ? (loanAmount / (collateralBtc * latestPrice)) * 100
    : 0;

  console.log(ltvRatio);

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
          <div
            className="text-font dark:text-font-dark w-full text-right text-xs font-medium
      flex justify-center items-center"
          >
            {formattedValue}%
          </div>
        </>
      )}
    </div>
  );
};
