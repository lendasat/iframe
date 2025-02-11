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

  const isNan = ltvRatio == null || isNaN(ltvRatio);

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
    <div className="flex items-center min-w-[80px] w-full gap-0">
      <div className="flex-1 bg-gray-200 h-1 rounded-full">
        <div
          className={`h-full rounded-full ${barColor}`}
          role="progressbar"
          style={{ width: `${ltvRatio ?? 50}%` }}
          aria-valuenow={ltvRatio ?? 50}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="w-12 text-xs font-medium text-font dark:text-font-dark text-right">
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
