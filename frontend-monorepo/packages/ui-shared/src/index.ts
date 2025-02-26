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

export const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

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
export * from "./lib/UserStats";
export * from "./lib/components/KycBadge";
export * from "./lib/bank-details/bank-details-dialog";
export * from "./lib/bank-details/banking-details-summary";
export * from "./lib/components/NotificationToast";
