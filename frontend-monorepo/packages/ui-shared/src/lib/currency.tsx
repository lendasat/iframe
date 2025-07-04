import type { FC } from "react";
import { Currency } from "./models";

export const formatCurrency = (
  value: number,
  currency: Currency = Currency.USD,
  minFraction?: number,
  maxFraction?: number,
) => {
  let minimumFractionDigits = minFraction || 0;
  let maximumFractionDigits = maxFraction || 2;
  if (minFraction && !maxFraction) {
    maximumFractionDigits = minFraction;
  }
  if (!minFraction && maxFraction) {
    minimumFractionDigits = 0;
  }

  // Map Currency enum to Intl currency codes
  const currencyCode = currency === Currency.EUR ? "EUR" : "USD";

  // We make use of system locals
  // - On a US system: "€1,000.00"
  // - On a German system:  "1.000,00 €"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};

interface formatCurrencyProps {
  value: number;
  currency?: Currency;
  minFraction: number;
  maxFraction: number;
}

export const newFormatCurrency = ({
  maxFraction,
  minFraction,
  value,
  currency = Currency.USD,
}: formatCurrencyProps) => {
  let minFractionDigits = minFraction;
  if (minFraction > maxFraction) {
    minFractionDigits = maxFraction;
  }

  // Map Currency enum to Intl currency codes
  const currencyCode = currency === Currency.EUR ? "EUR" : "USD";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFraction,
  }).format(value);
};

interface CurrencyFormatterProps {
  value: number;
  currency?: Currency;
  minFraction?: number;
  maxFraction?: number;
}

export const CurrencyFormatter: FC<CurrencyFormatterProps> = ({
  value,
  currency = Currency.USD,
  maxFraction,
  minFraction,
}) => {
  return (
    <span>{formatCurrency(value, currency, minFraction, maxFraction)}</span>
  );
};

export default CurrencyFormatter;
