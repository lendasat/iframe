import { ONE_YEAR } from "./types";

const SATS_PER_BTC = 100_000_000;

export interface CollateralCalculation {
  /** The required collateral value in USD */
  collateralValueUsd: number;
  /** The required collateral in satoshis */
  collateralSats: number;
  /** The origination fee in Usd */
  originationFeeUsd: number;
  /** The origination fee in satoshis */
  originationFeeSats: number;
  /** The actual interest rate for this loan duration (interestPerDay * durationDays) */
  actualInterestRate: number;
  /** The total interest to be paid in USD */
  totalInterestUsd: number;
  /** The total interest to be paid in satoshis */
  totalInterestSats: number;
  /** The total value owed (loan + interest) in satoshis */
  totalValueOwedSats: number;
  /** The total value to deposit (collateral + interest + origination fee) in satoshis */
  totalValueToDepositSats: number;
  /** The total value to deposit (collateral + interest + origination fee) in USD */
  totalValueToDepositUsd: number;
}

/**
 * Calculate comprehensive loan collateral and fee details
 *
 * @param loanAmountUsd - The loan amount in USD
 * @param ltv - The loan-to-value ratio (e.g., 0.5 for 50% LTV)
 * @param btcPriceUsd - The current Bitcoin price in USD
 * @param interestRate - The annual interest rate as a decimal (e.g., 0.10 for 10% APR)
 * @param durationDays - The loan duration in days
 * @param originationFeeRate - The origination fee as a decimal (e.g., 0.015 for 1.5%)
 * @returns Detailed breakdown of collateral, fees, and amounts
 *
 * @example
 * // For a $1000 loan at 50% LTV, 10% APR, 30 days, with 1.5% origination fee, BTC at $50,000
 * const calculation = calculateCollateralNeeded(1000, 0.5, 50000, 0.10, 30, 0.015);
 * // Returns:
 * // {
 * //   collateralValueUsd: 2000,
 * //   collateralSats: 4000000,
 * //   originationFeeUsd: 15,
 * //   originationFeeSats: 30000,
 * //   actualInterestRate: 0.00833, // (0.10 * 30) / 360
 * //   totalInterestUsd: 8.33,
 * //   totalInterestSats: 16660,
 * //   totalValueOwedSats: 2033320,
 * //   totalValueToDepositSats: 4063320,
 * //   totalValueToDepositUsd: 2031.66
 * // }
 */
export function calculateCollateralNeeded(
  loanAmountUsd: number,
  ltv: number,
  btcPriceUsd: number,
  interestRate: number,
  durationDays: number,
  originationFeeRate: number,
): CollateralCalculation {
  // Return all zeros if invalid input
  if (
    ltv <= 0 ||
    ltv > 1 ||
    btcPriceUsd <= 0 ||
    loanAmountUsd < 0 ||
    interestRate < 0 ||
    durationDays <= 0 ||
    originationFeeRate < 0
  ) {
    return {
      collateralValueUsd: 0,
      collateralSats: 0,
      originationFeeUsd: 0,
      originationFeeSats: 0,
      actualInterestRate: 0,
      totalInterestUsd: 0,
      totalInterestSats: 0,
      totalValueOwedSats: 0,
      totalValueToDepositSats: 0,
      totalValueToDepositUsd: 0,
    };
  }

  // Calculate collateral
  // LTV = Loan Value / Collateral Value
  // Therefore: Collateral Value = Loan Value / LTV
  const collateralValueUsd = loanAmountUsd / ltv;
  const collateralBtc = collateralValueUsd / btcPriceUsd;
  const collateralSats = Math.ceil(collateralBtc * SATS_PER_BTC);

  // Calculate origination fee
  const originationFeeUsd = loanAmountUsd * originationFeeRate;
  const originationFeeBtc = originationFeeUsd / btcPriceUsd;
  const originationFeeSats = Math.ceil(originationFeeBtc * SATS_PER_BTC);

  // Calculate total interest
  // Interest = Principal × Rate × (Days / 365)
  const actualInterestRate = interestRate * (durationDays / ONE_YEAR);
  const totalInterestUsd = loanAmountUsd * actualInterestRate;
  const totalInterestBtc = totalInterestUsd / btcPriceUsd;
  const totalInterestSats = Math.ceil(totalInterestBtc * SATS_PER_BTC);

  // Calculate total value owed (loan + interest)
  const totalValueOwedUsd = loanAmountUsd + totalInterestUsd;
  const totalValueOwedBtc = totalValueOwedUsd / btcPriceUsd;
  const totalValueOwedSats = Math.ceil(totalValueOwedBtc * SATS_PER_BTC);

  // Calculate total value to deposit
  // Formula: (loan amount + interest) / LTV + origination fee
  // Since LTV = Loan / Collateral, Collateral = Loan / LTV
  const totalValueToDepositUsd =
    (loanAmountUsd + totalInterestUsd) / ltv + originationFeeUsd;
  const totalValueToDepositBtc = totalValueToDepositUsd / btcPriceUsd;
  const totalValueToDepositSats = Math.ceil(
    totalValueToDepositBtc * SATS_PER_BTC,
  );

  return {
    collateralValueUsd,
    collateralSats,
    originationFeeUsd,
    originationFeeSats,
    actualInterestRate,
    totalInterestUsd,
    totalInterestSats,
    totalValueOwedSats,
    totalValueToDepositSats,
    totalValueToDepositUsd,
  };
}
