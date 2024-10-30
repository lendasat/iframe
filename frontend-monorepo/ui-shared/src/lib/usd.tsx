import type { FC } from "react";

export const formatCurrency = (value: number, minFraction: number = 0, maxFraction: number = 0) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  }).format(value);
};

interface CurrencyFormatterProps {
  value: number;
}

export const CurrencyFormatter: FC<CurrencyFormatterProps> = ({ value }) => {
  return <span>{formatCurrency(value)}</span>;
};

export default CurrencyFormatter;
