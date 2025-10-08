import type { components } from "./openapi/schema";
import { parseISO } from "date-fns";

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
): "created_at" | "loan_amount" | "expiry_date" | "interest_rate" | "status" | "collateral_sats" | "updated_at" {
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
