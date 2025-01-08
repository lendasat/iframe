import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import type { LoanFeature } from "@frontend-monorepo/base-http-client";
import type { LoanAssetChain, LoanAssetType, LoanTransaction } from "@frontend-monorepo/ui-shared";

export enum ContractStatus {
  Requested = "Requested",
  RenewalRequested = "RenewalRequested",
  Approved = "Approved",
  CollateralSeen = "CollateralSeen",
  CollateralConfirmed = "CollateralConfirmed",
  PrincipalGiven = "PrincipalGiven",
  RepaymentProvided = "RepaymentProvided",
  RepaymentConfirmed = "RepaymentConfirmed",
  Undercollateralized = "Undercollateralized",
  Defaulted = "Defaulted",
  Closing = "Closing",
  Closed = "Closed",
  Extended = "Extended",
  Rejected = "Rejected",
  DisputeBorrowerStarted = "DisputeBorrowerStarted",
  DisputeLenderStarted = "DisputeLenderStarted",
  DisputeBorrowerResolved = "DisputeBorrowerResolved",
  DisputeLenderResolved = "DisputeLenderResolved",
  Cancelled = "Cancelled",
  RequestExpired = "RequestExpired",
}

export function contractStatusToLabelString(status: ContractStatus): string {
  switch (status) {
    case ContractStatus.Requested:
      return "Requested";
    case ContractStatus.RenewalRequested:
      return "Renewal Requested";
    case ContractStatus.Approved:
      return "Approved";
    case ContractStatus.CollateralSeen:
      return "Collateral Seen";
    case ContractStatus.CollateralConfirmed:
      return "Collateral Confirmed";
    case ContractStatus.PrincipalGiven:
      return "Open";
    case ContractStatus.RepaymentProvided:
      return "Repayment Provided";
    case ContractStatus.RepaymentConfirmed:
      return "Repayment Confirmed";
    case ContractStatus.Undercollateralized:
      return "Undercollateralized";
    case ContractStatus.Defaulted:
      return "Defaulted";
    case ContractStatus.Closing:
      return "Closing";
    case ContractStatus.Closed:
      return "Closed";
    case ContractStatus.Extended:
      return "Extended";
    case ContractStatus.Rejected:
      return "Rejected";
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      return "Dispute Open";
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      return "Dispute Resolved";
    case ContractStatus.Cancelled:
      return "Cancelled";
    case ContractStatus.RequestExpired:
      return "Request Expired";
  }
}

export const actionFromStatus = (status: ContractStatus) => {
  switch (status) {
    case ContractStatus.Approved:
      return "Fund it now";
    case ContractStatus.RepaymentConfirmed:
      return "Withdraw collateral";
    case ContractStatus.Requested:
    case ContractStatus.RenewalRequested:
    case ContractStatus.Rejected:
    case ContractStatus.RequestExpired:
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    case ContractStatus.Undercollateralized:
    case ContractStatus.Defaulted:
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.Closing:
    case ContractStatus.Cancelled:
      return "Details";
  }
};

export enum LiquidationStatus {
  Healthy = "Healthy",
  Liquidated = "Liquidated",
  SecondMarginCall = "SecondMarginCall",
  FirstMarginCall = "FirstMarginCall",
}

export interface LenderProfile {
  id: string;
  name: string;
}

export interface BorrowerProfile {
  id: string;
  name: string;
}

export interface ContractRequest {
  loan_id: string;
  loan_amount: number;
  duration_months: number;
  borrower_btc_address: string;
  borrower_pk: string;
  borrower_loan_address?: string;
  integration: Integration;
  moon_card_id?: string;
}

export interface Contract {
  id: string;
  loan_amount: number;
  duration_months: number;
  created_at: Date;
  updated_at: Date;
  repaid_at: Date | undefined;
  expiry: Date;
  interest_rate: number;
  initial_collateral_sats: number;
  origination_fee_sats: number;
  collateral_sats: number;
  initial_ltv: number;
  loan_asset_type: LoanAssetType;
  loan_asset_chain: LoanAssetChain;
  status: ContractStatus;
  liquidation_status: LiquidationStatus;
  lender: LenderProfile;
  borrower_pk: string;
  borrower_btc_address: string;
  loan_repayment_address: string;
  contract_address?: string;
  borrower_loan_address: string;
  transactions: LoanTransaction[];
  integration: Integration;
  liquidation_price: number;
  extends_contract?: string;
  extended_by_contract?: string;
}

export interface ClaimCollateralPsbtResponse {
  psbt: string;
  collateral_descriptor: string;
  borrower_pk: string;
}

export interface LoanOffer {
  id: string;
  lender: LenderProfile;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  duration_months_min: number;
  duration_months_max: number;
  loan_asset_type: string;
  loan_asset_chain: string;
  origination_fee: OriginationFee[];
}

export interface PostLoanRequest {
  ltv: number;
  interest_rate: number;
  loan_amount: number;
  duration_months: number;
  loan_asset_type: LoanAssetType;
  loan_asset_chain: LoanAssetChain;
}

export interface ExtendPostLoanRequest {
  loan_id: string;
  new_duration: number;
}

export interface LoanRequest {
  id: string;
  borrower: BorrowerProfile;
  ltv: number;
  interest_rate: number;
  loan_amount: number;
  duration_months: number;
  loan_asset_type: LoanAssetType;
  loan_asset_chain: LoanAssetChain;
  status: LoanRequestStatus;
}

export enum LoanRequestStatus {
  Available = "Available",
  Unavailable = "Unavailable",
  Deleted = "Deleted",
}

export enum DisputeStatus {
  StartedBorrower = "StartedBorrower",
  StartedLender = "StartedLender",
  ResolvedBorrower = "ResolvedBorrower",
  ResolvedLender = "ResolvedLender",
}

export interface Dispute {
  id: string;
  contract_id: string;
  borrower_id: string;
  lender_id: string;
  lender_payout_sats?: number;
  borrower_payout_sats?: number;
  comment: string;
  status: DisputeStatus;
  created_at: Date;
  updated_at: Date;
}

export interface OriginationFee {
  from_month: number;
  to_month: number;
  fee: number;
}

export class OriginationFeeHelper {
  static isRelevant(originationFee: OriginationFee, contractDuration: number): boolean {
    return originationFee.from_month <= contractDuration && originationFee.to_month > contractDuration;
  }
}

export function findBestOriginationFee(
  originationFees: OriginationFee[],
  contractDuration: number,
): number {
  const relevantFees = originationFees.filter(fee => OriginationFeeHelper.isRelevant(fee, contractDuration));

  if (relevantFees.length === 0) {
    return 0.01;
  }

  const bestFee = relevantFees.reduce((bestFee, currentFee) => {
    return currentFee.fee < bestFee.fee ? currentFee : bestFee;
  });
  return bestFee.fee;
}

export interface UserCardDetail {
  id: string;
  balance: number;
  available_balance: number;
  pan: string;
  cvv: string;
  expiration: string;
}

export class FeatureMapper {
  private static readonly FEATURE_MAP: Record<string, LoanProductOption> = {
    [LoanProductOption.StableCoins]: LoanProductOption.StableCoins,
    [LoanProductOption.PayWithMoonDebitCard]: LoanProductOption.PayWithMoonDebitCard,
    // Add other mappings once we use them
  };

  static mapEnabledFeatures(features: LoanFeature[]): LoanProductOption[] {
    return features.flatMap((feature) => {
      const mappedFeature = this.FEATURE_MAP[feature.id];
      return mappedFeature ? [mappedFeature] : [];
    });
  }
}

export enum Integration {
  PayWithMoon = "PayWithMoon",
  StableCoin = "StableCoin",
}

export enum CardTransactionStatus {
  Authorization = "Authorization",
  Reversal = "Reversal",
  Clearing = "Clearing",
  Refund = "Refund",
  Pending = "Pending",
}

export type CardTransaction =
  | { type: "Card"; data: TransactionData }
  | { type: "CardAuthorizationRefund"; data: TransactionData }
  | { type: "DeclineData"; data: DeclineData };

export interface TransactionData {
  card: TransactionCard;
  transaction_id: string;
  transaction_status: TransactionStatus;
  datetime: string;
  merchant: string;
  amount: number;
  ledger_currency: string;
  amount_fees_in_ledger_currency: number;
  amount_in_transaction_currency: number;
  transactionCurrency: string;
  amount_fees_i_tTransaction_currency: number;
  fees: Fee[];
}

export interface DeclineData {
  datetime: string;
  merchant: string;
  customer_friendly_description: string;
  amount: number;
  card: TransactionCard;
}

export interface TransactionCard {
  public_id: string;
  name: string;
  type: string;
}

export type TransactionStatus =
  | "Authorization"
  | "Reversal"
  | "Clearing"
  | "Refund"
  | "Pending"
  | "Settled"
  | string;

export interface Fee {
  type: string;
  amount: number;
  fee_description: string;
}
