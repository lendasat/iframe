import type { LoanAssetChain, LoanAssetType, LoanTransaction } from "@frontend-monorepo/ui-shared";

export enum ContractStatus {
  Requested = "Requested",
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

export function contractStatusToLabelString(status: ContractStatus): string {
  switch (status) {
    case ContractStatus.Requested:
      return "Requested";
    case ContractStatus.Approved:
      return "Approved";
    case ContractStatus.CollateralSeen:
      return "Collateral Seen";
    case ContractStatus.CollateralConfirmed:
      return "Collateral Confirmed";
    case ContractStatus.PrincipalGiven:
      return "Principal Disbursed";
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
