import type { FC } from "react";

export const formatCurrency = (value: number, minFraction?: number, maxFraction?: number) => {
  let minimumFractionDigits = minFraction || 0;
  let maximumFractionDigits = maxFraction || 2;
  if (minFraction && !maxFraction) {
    maximumFractionDigits = minFraction;
  }
  if (!minFraction && maxFraction) {
    minimumFractionDigits = 0;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};

interface CurrencyFormatterProps {
  value: number;
  minFraction?: number;
  maxFraction?: number;
}

export const CurrencyFormatter: FC<CurrencyFormatterProps> = ({ value, maxFraction, minFraction }) => {
  return <span>{formatCurrency(value, minFraction, maxFraction)}</span>;
};

export default CurrencyFormatter;
