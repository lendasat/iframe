import type { components } from "./openapi/schema";
import { parseISO } from "date-fns";

export const ONE_YEAR = 360;
export const ONE_MONTH = 30;

// Referral Code types
export interface PersonalReferralCode {
  active: boolean;
  code: string;
  commissionRateReferrer: number;
  createdAt: Date;
  expiresAt: Date;
  firstTimeCommissionRateReferrer: number;
}

// Loan Feature types
export interface LoanFeature {
  id: string;
  name: string;
}

// User types
export interface User {
  createdAt: Date;
  email: string;
  firstTimeDiscountRate: number;
  id: string;
  locale?: string | null;
  name: string;
  personalReferralCodes: PersonalReferralCode[];
  personalTelegramToken: string;
  timezone?: string | null;
  totpEnabled: boolean;
  updatedAt: Date;
  usedReferralCode?: string | null;
  verified: boolean;
}

// Me Response type
export interface MeResponse {
  enabledFeatures: LoanFeature[];
  user: User;
}

// Mapper functions to convert schema types to our custom types
export function mapPersonalReferralCode(
  code: components["schemas"]["PersonalReferralCodeResponse"],
): PersonalReferralCode {
  return {
    active: code.active,
    code: code.code,
    commissionRateReferrer: code.commission_rate_referrer,
    createdAt: parseISO(code.created_at),
    expiresAt: parseISO(code.expires_at),
    firstTimeCommissionRateReferrer: code.first_time_commission_rate_referrer,
  };
}

export function mapLoanFeature(
  feature: components["schemas"]["BorrowerLoanFeatureResponse"],
): LoanFeature {
  return {
    id: feature.id,
    name: feature.name,
  };
}

export function mapUser(user: components["schemas"]["FilteredUser"]): User {
  return {
    createdAt: parseISO(user.created_at),
    email: user.email,
    firstTimeDiscountRate: user.first_time_discount_rate,
    id: user.id,
    locale: user.locale,
    name: user.name,
    personalReferralCodes: user.personal_referral_codes.map(
      mapPersonalReferralCode,
    ),
    personalTelegramToken: user.personal_telegram_token,
    timezone: user.timezone,
    totpEnabled: user.totp_enabled,
    updatedAt: parseISO(user.updated_at),
    usedReferralCode: user.used_referral_code,
    verified: user.verified,
  };
}

export function mapMeResponse(
  response: components["schemas"]["MeResponse"],
): MeResponse {
  return {
    enabledFeatures: response.enabled_features.map(mapLoanFeature),
    user: mapUser(response.user),
  };
}

// Contract types
export type ContractStatus =
  | "Requested"
  | "Approved"
  | "CollateralSeen"
  | "CollateralConfirmed"
  | "PrincipalGiven"
  | "RepaymentProvided"
  | "RepaymentConfirmed"
  | "Undercollateralized"
  | "Defaulted"
  | "ClosingByClaim"
  | "Closed"
  | "ClosingByLiquidation"
  | "ClosedByLiquidation"
  | "ClosingByDefaulting"
  | "ClosedByDefaulting"
  | "Extended"
  | "Rejected"
  | "DisputeBorrowerStarted"
  | "DisputeLenderStarted"
  | "Cancelled"
  | "RequestExpired"
  | "ApprovalExpired"
  | "CollateralRecoverable"
  | "ClosingByRecovery"
  | "ClosedByRecovery";

export type SortField =
  | "createdAt"
  | "loanAmount"
  | "expiryDate"
  | "interestRate"
  | "status"
  | "collateralSats"
  | "updatedAt";

export type SortOrder = "asc" | "desc";

// Mappers to convert from camelCase to snake_case for API
const sortFieldToSnakeCase = {
  createdAt: "created_at",
  loanAmount: "loan_amount",
  expiryDate: "expiry_date",
  interestRate: "interest_rate",
  status: "status",
  collateralSats: "collateral_sats",
  updatedAt: "updated_at",
} as const;

export function mapSortField(
  field: SortField,
):
  | "created_at"
  | "loan_amount"
  | "expiry_date"
  | "interest_rate"
  | "status"
  | "collateral_sats"
  | "updated_at" {
  return sortFieldToSnakeCase[field];
}

export interface Contract {
  balanceOutstanding: number;
  borrowerBtcAddress: string;
  borrowerDerivationPath?: string | null;
  borrowerLoanAddress?: string | null;
  borrowerPk: string;
  btcLoanRepaymentAddress?: string | null;
  canExtend: boolean;
  clientContractId?: string | null;
  collateralSats: number;
  collateralScript?: string | null;
  contractAddress?: string | null;
  createdAt: Date;
  depositedSats: number;
  durationDays: number;
  expiry: Date;
  extendedByContract?: string | null;
  extendsContract?: string | null;
  extensionInterestRate?: number | null;
  extensionMaxDurationDays: number;
  id: string;
  initialCollateralSats: number;
  initialLtv: number;
  interest: number;
  interestRate: number;
  lender: LenderStats;
  lenderPk: string;
  liquidationPrice: number;
  loanAmount: number;
  ltvThresholdLiquidation: number;
  ltvThresholdMarginCall1: number;
  ltvThresholdMarginCall2: number;
  originationFeeSats: number;
  status: ContractStatus;
  updatedAt: Date;
}

export interface PaginatedContractsResponse {
  data: Contract[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export function mapContract(
  contract: components["schemas"]["Contract"],
): Contract {
  return {
    balanceOutstanding: contract.balance_outstanding,
    borrowerBtcAddress: contract.borrower_btc_address,
    borrowerDerivationPath: contract.borrower_derivation_path,
    borrowerLoanAddress: contract.borrower_loan_address,
    borrowerPk: contract.borrower_pk,
    btcLoanRepaymentAddress: contract.btc_loan_repayment_address,
    canExtend: contract.can_extend,
    clientContractId: contract.client_contract_id,
    collateralSats: contract.collateral_sats,
    collateralScript: contract.collateral_script,
    contractAddress: contract.contract_address,
    createdAt: parseISO(contract.created_at),
    depositedSats: contract.deposited_sats,
    durationDays: contract.duration_days,
    expiry: parseISO(contract.expiry),
    extendedByContract: contract.extended_by_contract,
    extendsContract: contract.extends_contract,
    extensionInterestRate: contract.extension_interest_rate,
    extensionMaxDurationDays: contract.extension_max_duration_days,
    id: contract.id,
    initialCollateralSats: contract.initial_collateral_sats,
    initialLtv: contract.initial_ltv,
    interest: contract.interest,
    interestRate: contract.interest_rate,
    lender: mapLenderStats(contract.lender),
    lenderPk: contract.lender_pk,
    liquidationPrice: contract.liquidation_price,
    loanAmount: contract.loan_amount,
    ltvThresholdLiquidation: contract.ltv_threshold_liquidation,
    ltvThresholdMarginCall1: contract.ltv_threshold_margin_call_1,
    ltvThresholdMarginCall2: contract.ltv_threshold_margin_call_2,
    originationFeeSats: contract.origination_fee_sats,
    status: contract.status,
    updatedAt: parseISO(contract.updated_at),
  };
}

export function mapPaginatedContractsResponse(
  response: components["schemas"]["PaginatedContractsResponse"],
): PaginatedContractsResponse {
  return {
    data: response.data.map(mapContract),
    limit: response.limit,
    page: response.page,
    total: response.total,
    totalPages: response.total_pages,
  };
}

// Lender types
export interface LenderStats {
  id: string;
  joinedAt: Date;
  name: string;
  successfulContracts: number;
  timezone?: string | null;
  vetted: boolean;
}

export function mapLenderStats(
  lender: components["schemas"]["LenderStats"],
): LenderStats {
  return {
    id: lender.id,
    joinedAt: parseISO(lender.joined_at),
    name: lender.name,
    successfulContracts: lender.successful_contracts,
    timezone: lender.timezone,
    vetted: lender.vetted,
  };
}

// Loan Offer types
export type LoanOfferStatus = "Available" | "Unavailable" | "Deleted";
export type LoanPayout = "Direct" | "Indirect" | "MoonCardInstant";
export type QueryParamLoanType =
  | "Direct"
  | "Indirect"
  | "MoonCardInstant"
  | "All";
export type AssetTypeFilter = "fiat" | "stable_coins" | "all";
export type KycFilter = "no_kyc" | "with_kyc" | "all";

export interface OriginationFee {
  fee: number;
  fromDay: number;
}

export interface LoanOffer {
  durationDaysMax: number;
  durationDaysMin: number;
  id: string;
  interestRate: number;
  kycLink?: string | null;
  lender: LenderStats;
  lenderPk: string;
  loanAmountMax: number;
  loanAmountMin: number;
  loanAsset: LoanAsset;
  loanPayout: LoanPayout;
  loanRepaymentAddress: string;
  minLtv: number;
  name: string;
  originationFee: OriginationFee[];
  status: LoanOfferStatus;
}

export function mapOriginationFee(
  fee: components["schemas"]["OriginationFee"],
): OriginationFee {
  return {
    fee: fee.fee,
    fromDay: fee.from_day,
  };
}

/**
 * Get the applicable origination fee for a given number of days
 * @param originationFees - Array of origination fees sorted by fromDay
 * @param durationDays - The loan duration in days
 * @returns The fee rate (e.g., 0.015 for 1.5%)
 */
export function getOriginationFeeForDuration(
  originationFees: OriginationFee[],
  durationDays: number,
): number {
  if (originationFees.length === 0) return 0;

  // Sort fees by fromDay in descending order
  const sortedFees = [...originationFees].sort((a, b) => b.fromDay - a.fromDay);

  // Find the first fee where durationDays >= fromDay
  const applicableFee = sortedFees.find((fee) => durationDays >= fee.fromDay);

  return applicableFee?.fee ?? 0;
}

export function mapLoanOffer(
  offer: components["schemas"]["LoanOffer"],
): LoanOffer {
  return {
    durationDaysMax: offer.duration_days_max,
    durationDaysMin: offer.duration_days_min,
    id: offer.id,
    interestRate: offer.interest_rate,
    kycLink: offer.kyc_link,
    lender: mapLenderStats(offer.lender),
    lenderPk: offer.lender_pk,
    loanAmountMax: offer.loan_amount_max,
    loanAmountMin: offer.loan_amount_min,
    loanAsset: offer.loan_asset,
    loanPayout: offer.loan_payout,
    loanRepaymentAddress: offer.loan_repayment_address,
    minLtv: offer.min_ltv,
    name: offer.name,
    originationFee: offer.origination_fee.map(mapOriginationFee),
    status: offer.status,
  };
}

// Loan Application types
export type LoanApplicationStatus =
  | "Available"
  | "Unavailable"
  | "Taken"
  | "Deleted"
  | "ApplicationExpired"
  | "Cancelled";

export type LoanAsset =
  | "UsdcPol"
  | "UsdtPol"
  | "UsdcEth"
  | "UsdtEth"
  | "UsdcStrk"
  | "UsdtStrk"
  | "UsdcSol"
  | "UsdtSol"
  | "Usd"
  | "Eur"
  | "Chf"
  | "Mxn"
  | "UsdtLiquid";

// Helper functions for LoanAsset
export function isFiatAsset(asset: LoanAsset): boolean {
  return (
    asset === "Usd" || asset === "Eur" || asset === "Chf" || asset === "Mxn"
  );
}

export function isStableCoinAsset(asset: LoanAsset): boolean {
  return (
    asset === "UsdcPol" ||
    asset === "UsdtPol" ||
    asset === "UsdcEth" ||
    asset === "UsdtEth" ||
    asset === "UsdcStrk" ||
    asset === "UsdtStrk" ||
    asset === "UsdcSol" ||
    asset === "UsdtSol" ||
    asset === "UsdtLiquid"
  );
}

export function formatLoanAsset(asset: LoanAsset): string {
  switch (asset) {
    case "UsdcPol":
      return "USDC on Polygon";
    case "UsdtPol":
      return "USDT on Polygon";
    case "UsdcEth":
      return "USDC on Ethereum";
    case "UsdtEth":
      return "USDT on Ethereum";
    case "UsdcStrk":
      return "USDC on Starknet";
    case "UsdtStrk":
      return "USDT on Starknet";
    case "UsdcSol":
      return "USDC on Solana";
    case "UsdtSol":
      return "USDT on Solana";
    case "UsdtLiquid":
      return "USDT on Liquid";
    case "Usd":
      return "USD";
    case "Eur":
      return "EUR";
    case "Chf":
      return "CHF";
    case "Mxn":
      return "MXN";
    default:
      return asset;
  }
}

export type LoanType =
  | "PayWithMoon"
  | "MoonCardInstant"
  | "StableCoin"
  | "Fiat"
  | "Bringin";

export type RepaymentPlan =
  | "bullet"
  | "interest_only_weekly"
  | "interest_only_monthly";

export interface LoanApplication {
  borrowerBtcAddress: string;
  borrowerDerivationPath: string;
  borrowerId: string;
  borrowerLoanAddress?: string | null;
  borrowerNpub: string;
  borrowerPk: string;
  clientContractId?: string | null;
  createdAt: Date;
  durationDaysMax: number;
  durationDaysMin: number;
  interestRate: number;
  loanAmountMax: number;
  loanAmountMin: number;
  loanAsset: LoanAsset;
  loanDealId: string;
  loanType: LoanType;
  ltv: number;
  repaymentPlan: RepaymentPlan;
  status: LoanApplicationStatus;
  updatedAt: Date;
}

export function mapLoanApplication(
  application: components["schemas"]["LoanApplication"],
): LoanApplication {
  return {
    borrowerBtcAddress: application.borrower_btc_address,
    borrowerDerivationPath: application.borrower_derivation_path,
    borrowerId: application.borrower_id,
    borrowerLoanAddress: application.borrower_loan_address,
    borrowerNpub: application.borrower_npub,
    borrowerPk: application.borrower_pk,
    clientContractId: application.client_contract_id,
    createdAt: parseISO(application.created_at),
    durationDaysMax: application.duration_days_max,
    durationDaysMin: application.duration_days_min,
    interestRate: application.interest_rate,
    loanAmountMax: application.loan_amount_max,
    loanAmountMin: application.loan_amount_min,
    loanAsset: application.loan_asset,
    loanDealId: application.loan_deal_id,
    loanType: application.loan_type,
    ltv: application.ltv,
    repaymentPlan: application.repayment_plan,
    status: application.status,
    updatedAt: parseISO(application.updated_at),
  };
}

export enum Currency {
  CHF = "CHF",
  USD = "Usd",
  EUR = "Eur",
}
