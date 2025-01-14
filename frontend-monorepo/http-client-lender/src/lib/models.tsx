import { type LoanFeature } from "@frontend-monorepo/base-http-client";
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

export interface BorrowerProfile {
  id: string;
  name: string;
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
  status: ContractStatus;
  liquidation_status: LiquidationStatus;
  borrower: BorrowerProfile;
  borrower_pk: string;
  borrower_btc_address: string;
  loan_repayment_address: string;
  contract_address?: string;
  borrower_loan_address: string;
  transactions: LoanTransaction[];
  loan_asset_type: LoanAssetType;
  loan_asset_chain: LoanAssetChain;
  can_recover_collateral_manually: boolean;
  extends_contract?: string;
  extended_by_contract?: string;
}

export interface CreateLoanOfferRequest {
  name: string;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  loan_amount_reserve: number;
  duration_months_min: number;
  duration_months_max: number;
  loan_asset_type: LoanAssetType;
  loan_asset_chain: LoanAssetChain;
  loan_repayment_address: string;
  auto_accept: boolean;
  lender_xpub: string;
}

export enum LoanOfferStatus {
  Available = "Available",
  Unavailable = "Unavailable",
  Deleted = "Deleted",
}

export interface LoanOffer {
  id: string;
  lender_id: string;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  loan_amount_reserve: number;
  loan_amount_reserve_remaining: number;
  duration_months_min: number;
  duration_months_max: number;
  loan_asset_type: string;
  loan_asset_chain: string;
  status: LoanOfferStatus;
  auto_accept: boolean;
  created_at: string;
  updated_at: string;
}

export const actionFromStatus = (status: ContractStatus) => {
  let statusText = "";
  switch (status) {
    case ContractStatus.RenewalRequested:
    case ContractStatus.Requested:
      statusText = "Approve or Reject";
      break;
    case ContractStatus.CollateralConfirmed:
      statusText = "Pay out principal";
      break;
    case ContractStatus.RepaymentProvided:
      statusText = "Confirm repayment";
      break;
    case ContractStatus.Undercollateralized:
    case ContractStatus.Defaulted:
      statusText = "Liquidate collateral";
      break;
    case ContractStatus.Approved:
    case ContractStatus.Rejected:
    case ContractStatus.RequestExpired:
    case ContractStatus.CollateralSeen:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.Closing:
    case ContractStatus.Cancelled:
      statusText = "Details";
      break;
  }
  return statusText;
};

export function contractStatusToLabelString(status: ContractStatus): string {
  let statusText = "";
  switch (status) {
    case ContractStatus.Requested:
      statusText = "Requested";
      break;
    case ContractStatus.RenewalRequested:
      statusText = "Renewal Requested";
      break;
    case ContractStatus.Approved:
      statusText = "Approved";
      break;
    case ContractStatus.CollateralSeen:
      statusText = "Collateral Seen";
      break;
    case ContractStatus.CollateralConfirmed:
      statusText = "Collateral Confirmed";
      break;
    case ContractStatus.PrincipalGiven:
      statusText = "Principal Disbursed";
      break;
    case ContractStatus.RepaymentProvided:
      statusText = "Repayment Provided";
      break;
    case ContractStatus.RepaymentConfirmed:
      statusText = "Repayment Confirmed";
      break;
    case ContractStatus.Undercollateralized:
      statusText = "Undercollateralized";
      break;
    case ContractStatus.Defaulted:
      statusText = "Defaulted";
      break;
    case ContractStatus.Closing:
      statusText = "Closing";
      break;
    case ContractStatus.Closed:
      statusText = "Closed";
      break;
    case ContractStatus.Extended:
      statusText = "Extended";
      break;
    case ContractStatus.Rejected:
      statusText = "Rejected";
      break;
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      statusText = "Dispute Open";
      break;
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      statusText = "Dispute Resolved";
      break;
    case ContractStatus.Cancelled:
      statusText = "Cancelled";
      break;
    case ContractStatus.RequestExpired:
      statusText = "Request Expired";
      break;
  }
  return statusText;
}

export enum LiquidationStatus {
  Healthy = "Healthy",
  Liquidated = "Liquidated",
  SecondMarginCall = "SecondMarginCall",
  FirstMarginCall = "FirstMarginCall",
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

export interface LenderProfile {
  id: string;
  name: string;
}

export interface BorrowerProfile {
  id: string;
  name: string;
}

export enum TransactionType {
  Funding = "Funding",
  Dispute = "Dispute",
  PrincipalGiven = "PrincipalGiven",
  PrincipalRepaid = "PrincipalRepaid",
  Liquidation = "Liquidation",
  ClaimCollateral = "ClaimCollateral",
}

export interface GetLiquidationPsbtResponse {
  psbt: string;
  collateral_descriptor: string;
  lender_pk: string;
}

export interface LiquidationToStableCoinPsbt {
  psbt: string;
  collateral_descriptor: string;
  lender_pk: string;
  settle_address: string;
  settle_amount: number;
}

export interface GetRecoveryPsbtResponse {
  psbt: string;
  collateral_descriptor: string;
  lender_pk: string;
}

// Warning: only change the string values if you know what you are doing.
// They are linked to the database and if changed some features might stop
// working.
export enum LenderFeatureFlags {
  AutoApproveLoanRequests = "auto_approve",
}

export class FeatureMapper {
  private static readonly FEATURE_MAP: Record<string, LenderFeatureFlags> = {
    [LenderFeatureFlags.AutoApproveLoanRequests]: LenderFeatureFlags.AutoApproveLoanRequests,
    // Add other mappings once we use them
  };

  static mapEnabledFeatures(features: LoanFeature[]): LenderFeatureFlags[] {
    return features.flatMap((feature) => {
      const mappedFeature = this.FEATURE_MAP[feature.id];
      return mappedFeature ? [mappedFeature] : [];
    });
  }
}

export interface LoanAndContractStats {
  contract_stats: ContractStats[];
  loan_offer_stats: LoanOfferStats;
}

export interface LoanOfferStats {
  avg: number;
  min: number;
  max: number;
}

export interface ContractStats {
  loan_amount: number;
  duration_months: number;
  interest_rate: number;
  created_at: string;
}
