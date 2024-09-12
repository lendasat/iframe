import { FC } from "react";

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface CurrencyFormatterProps {
  value: number;
}

export const CurrencyFormatter: FC<CurrencyFormatterProps> = ({ value }) => {
  return <span>{formatCurrency(value)}</span>;
};

export default CurrencyFormatter;
