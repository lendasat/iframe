import type { FC } from "react";
import { usePrice } from "../price-context";
import { Progress } from "@frontend/shadcn";
import { Loader } from "lucide-react";

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

  const isNan = ltvRatio == null || Number.isNaN(ltvRatio);

  const formattedValue = isNan ? "Loading" : ltvRatio.toFixed(0);

  return (
    <div className="flex w-full min-w-[80px] items-center gap-0">
      <Progress value={ltvRatio ?? 0} className={"hidden md:block"} />
      <div
        className="text-font dark:text-font-dark w-full text-right text-xs font-medium
      flex justify-center items-center"
      >
        {isNan ? <Loader className="animate-spin" /> : `${formattedValue}%`}
      </div>
    </div>
  );
};
