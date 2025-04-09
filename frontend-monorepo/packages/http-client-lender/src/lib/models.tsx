import {
  FiatLoanDetailsResponse,
  type LoanFeature,
} from "@frontend/base-http-client";
import { LoanAsset, LoanTransaction } from "@frontend/ui-shared";

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
  ApprovalExpired = "ApprovalExpired",
}

export const ALL_CONTRACT_STATUSES = Object.values(
  ContractStatus,
) as ContractStatus[];

export interface Contract {
  id: string;
  loan_amount: number;
  duration_days: number;
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
  borrower: BorrowerStats;
  borrower_btc_address: string;
  loan_repayment_address: string;
  contract_address?: string;
  borrower_loan_address: string;
  transactions: LoanTransaction[];
  loan_asset: LoanAsset;
  can_recover_collateral_manually: boolean;
  liquidation_price: number;
  extends_contract?: string;
  extended_by_contract?: string;
  kyc_info?: KycInfo;
  fiat_loan_details_borrower?: FiatLoanDetailsResponse;
  fiat_loan_details_lender?: FiatLoanDetailsResponse;
  lender_pk: string;
  lender_npub: string;
  lender_derivation_path: string;
  borrower_npub: string;
  borrower_pk: string;
}

export interface KycInfo {
  kyc_link: string;
  is_kyc_done: boolean;
}

export interface CreateLoanOfferRequest {
  name: string;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  loan_amount_reserve: number;
  duration_days_min: number;
  duration_days_max: number;
  loan_asset: LoanAsset;
  loan_repayment_address: string;
  auto_accept: boolean;
  lender_npub: string;
  lender_pk: string;
  lender_derivation_path: string;
  kyc_link?: string;
}

export enum LoanOfferStatus {
  Available = "Available",
  Unavailable = "Unavailable",
  Deleted = "Deleted",
}

export interface LoanOffer {
  id: string;
  lender: BorrowerStats;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  loan_amount_reserve: number;
  loan_amount_reserve_remaining: number;
  duration_days_min: number;
  duration_days_max: number;
  loan_asset: LoanAsset;
  origination_fee: OriginationFee[];
  status: LoanOfferStatus;
  auto_accept: boolean;
  kyc_link?: string;
  created_at: Date;
  updated_at: Date;
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
    case ContractStatus.ApprovalExpired:
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
    case ContractStatus.ApprovalExpired:
      statusText = "Approval Expired";
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

export interface OriginationFee {
  from_day: number;
  to_day: number;
  fee: number;
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
  KycOffers = "kyc_offers",
}

export class FeatureMapper {
  private static readonly FEATURE_MAP: Record<string, LenderFeatureFlags> = {
    [LenderFeatureFlags.AutoApproveLoanRequests]:
      LenderFeatureFlags.AutoApproveLoanRequests,
    [LenderFeatureFlags.KycOffers]: LenderFeatureFlags.KycOffers,
    // Add other mappings once we use them
  };

  static mapEnabledFeatures(features: LoanFeature[]): LenderFeatureFlags[] {
    return features.flatMap((feature) => {
      const mappedFeature = FeatureMapper.FEATURE_MAP[feature.id];
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
  duration_days: number;
  interest_rate: number;
  created_at: string;
}

export interface LenderStats {
  id: string;
  name: string;
  successful_contracts: number;
  failed_contracts: number;
  rating: number;
  joined_at: Date;
  timezone: string;
}

export interface BorrowerStats {
  id: string;
  name: string;
  successful_contracts: number;
  failed_contracts: number;
  rating: number;
  joined_at: Date;
  timezone: string;
}

export interface PutUpdateProfile {
  timezone: string;
}

export interface BorrowerProfile {
  id: string;
  name: string;
}

export interface LoanApplication {
  id: string;
  borrower: BorrowerProfile;
  ltv: number;
  interest_rate: number;
  loan_amount: number;
  duration_days: number;
  liquidation_price: number;
  borrower_loan_address?: string;
  borrower_btc_address: string;
  loan_asset: LoanAsset;
  loan_type: LoanType;
  status: LoanApplicationStatus;
  created_at: Date;
  updated_at: Date;
}

export enum LoanApplicationStatus {
  Available = "Available",
  Unavailable = "Unavailable",
  Taken = "Taken",
  Deleted = "Deleted",
}

export class LoanApplicationStatusHelper {
  static print(status: LoanApplicationStatus): string {
    switch (status) {
      case LoanApplicationStatus.Available:
        return "Available";
      case LoanApplicationStatus.Unavailable:
        return "Unavailable";
      case LoanApplicationStatus.Taken:
        return "Taken";
      case LoanApplicationStatus.Deleted:
        return "Deleted";
    }
  }
}

export enum LoanType {
  StableCoin = "StableCoin",
  Fiat = "Fiat",
}

export interface TakeLoanApplicationSchema {
  lender_npub: string;
  loan_repayment_address: string;
  lender_pk: string;
  lender_derivation_path: string;
}

export interface NotifyUser {
  contract_id: string;
}
