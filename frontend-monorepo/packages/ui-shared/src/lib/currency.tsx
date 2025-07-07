import type { FC } from "react";
import { Currency } from "./models";
import i18n from "./i18n";

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

  return i18n.t("intlCurrencyWithOptions", {
    val: value,
    formatParams: {
      val: {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits,
        maximumFractionDigits,
      },
    },
  });
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

  return i18n.t("intlCurrencyWithOptions", {
    val: value,
    formatParams: {
      val: {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: minFractionDigits,
        maximumFractionDigits: maxFraction,
      },
    },
  });
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
