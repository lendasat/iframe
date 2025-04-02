import queryString from "query-string";
import { LoanAsset, TransactionType } from "./lib/models";

export const ONE_YEAR = 360;
export const ONE_MONTH = 30;

export function getFormatedStringFromDays(numberOfDays: number) {
  const years = Math.floor(numberOfDays / ONE_YEAR);
  const months = Math.floor((numberOfDays % ONE_YEAR) / ONE_MONTH);
  const days = Math.floor((numberOfDays % ONE_YEAR) % ONE_MONTH);

  const yearsDisplay =
    years > 0 ? years + (years === 1 ? " year" : " years") : "";
  const monthsDisplay =
    months > 0 ? months + (months === 1 ? " month" : " months") : "";
  const daysDisplay = days > 0 ? days + (days === 1 ? " day" : " days") : "";

  return yearsDisplay + monthsDisplay + daysDisplay;
}

export const formatSatsToBitcoin = (sats?: number) => {
  if (sats == null) return undefined;

  // Convert sats to BTC (1 BTC = 100,000,000 sats)
  const btcValue = sats / 100000000;

  // Format to 8 decimal places
  const formatted = btcValue.toFixed(8);

  // Split into integer and decimal parts
  const [integerPart, decimalPart] = formatted.split(".");

  // Group the decimal part in triplets from right to left
  let formattedDecimal = "";
  for (let i = 0; i < decimalPart.length; i++) {
    formattedDecimal += decimalPart[i];
    // Add space after every third digit, counting from the right
    if ((decimalPart.length - i - 1) % 3 === 0 && i < decimalPart.length - 1) {
      formattedDecimal += " ";
    }
  }

  // Combine parts
  return `${integerPart}.${formattedDecimal}`;
};

interface EncodeOptions {
  amount: number;
  label: string;
}

export function encodeBip21(
  address: string,
  options: EncodeOptions,
  urnScheme = "bitcoin",
): string {
  const scheme = urnScheme;

  if (options.amount !== undefined) {
    if (!Number.isFinite(options.amount)) {
      throw new TypeError("Invalid amount");
    }
    if (options.amount < 0) {
      throw new TypeError("Invalid amount");
    }
  }

  const query = queryString.stringify(options);
  return `${scheme}:${address}${(query ? "?" : "") + query}`;
}

export const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export function getTxUrl(txid: string, assetType?: LoanAsset) {
  let url = `${import.meta.env.VITE_MEMPOOL_REST_URL}/tx/${txid}`;
  switch (assetType) {
    case LoanAsset.USDC_ETH:
    case LoanAsset.USDT_ETH:
      url = "https://etherscan.io/tx";
      break;
    case LoanAsset.USDT_POL:
    case LoanAsset.USDC_POL:
      url = "https://polygonscan.com/tx";
      break;
    case LoanAsset.USDC_SN:
    case LoanAsset.USDT_SN:
      url = "https://starkscan.co/tx";
      break;
    case LoanAsset.USDC_SOL:
    case LoanAsset.USDT_SOL:
      url = "https://solscan.io/tx";
      break;
    case LoanAsset.USDT_Liquid:
      url = "https://liquid.network/tx";
      break;
    case LoanAsset.EUR:
    case LoanAsset.USD:
    case LoanAsset.CHF:
      url = "";
      break;
  }
  return url;
}

export * from "./lib/components/loan-address-input-field";
export * from "./lib/components/NotificationToast";
export * from "./lib/components/abbreviation-explanation-info";
export * from "./lib/components/LtvInfoLabel";
export * from "./lib/components/LiquidationPriceInfoLabel";
export * from "./lib/components/InterestRateInfoLabel";
export * from "./lib/components/RefundAddressInfoLabel";
export * from "./lib/components/timezone-selector";
export * from "./lib/full-logo-white-bg";
export * from "./lib/ltv-progress-bar/ltv-progress-bar";
export * from "./lib/auth/registration-form";
export * from "./lib/auth/waitlist-form";
export * from "./lib/auth/waitlist-success";
export * from "./lib/auth/email-verification-form";
export * from "./lib/auth/login-form";
export * from "./lib/auth/forgot-password-form";
export * from "./lib/auth/reset-password-form";
export * from "./lib/main-layout";
export * from "./lib/header-component";
export * from "./lib/usd";
export * from "./lib/price-context";
export * from "./lib/components/theme-provider";
export * from "./lib/components/TransactionList";
export * from "./lib/models";
export * from "./lib/auth/upgrade-to-pake";
export * from "./lib/auth/upgrade-to-pake-form";
export * from "./lib/components/mnemonic";
export * from "./lib/components/nostr-chat-settings";
export * from "./lib/UserStats";
export * from "./lib/components/KycBadge";
export * from "./lib/bank-details/bank-details-dialog";
export * from "./lib/bank-details/banking-details-summary";
export * from "./lib/components/NotificationToast";
