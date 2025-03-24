import type { FC } from "react";
import { Spinner } from "react-bootstrap";
import { usePrice } from "../price-context";

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
    : undefined;

  let barColor = "";

  const isNan = ltvRatio == null || Number.isNaN(ltvRatio);

  const formattedValue = isNan ? "Loading" : ltvRatio.toFixed(0);

  if (isNan) {
    barColor = "bg-secondary";
  } else if (ltvRatio < 70) {
    barColor = "bg-success";
  } else if (ltvRatio < 90) {
    barColor = "bg-warning";
  } else {
    barColor = "bg-danger";
  }

  return (
    <div className="flex w-full min-w-[80px] items-center gap-0">
      <div className="h-1 flex-1 rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${barColor}`}
          role="progressbar"
          style={{ width: `${ltvRatio ?? 50}%` }}
          aria-valuenow={ltvRatio ?? 50}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="text-font dark:text-font-dark w-12 text-right text-xs font-medium">
        {isNan ? (
          <Spinner animation="border" role="status" size="sm">
            <span className="sr-only">Loading...</span>
          </Spinner>
        ) : (
          `${formattedValue}%`
        )}
      </div>
    </div>
  );
};
