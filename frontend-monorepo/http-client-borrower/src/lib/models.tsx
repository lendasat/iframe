export enum ContractStatus {
  Requested = "Requested",
  Approved = "Approved",
  CollateralSeen = "CollateralSeen",
  CollateralConfirmed = "CollateralConfirmed",
  PrincipalGiven = "PrincipalGiven",
  Closing = "Closing",
  Repaid = "Repaid",
  Closed = "Closed",
  Rejected = "Rejected",
  DisputeBorrowerStarted = "DisputeBorrowerStarted",
  DisputeLenderStarted = "DisputeLenderStarted",
  DisputeBorrowerResolved = "DisputeBorrowerResolved",
  DisputeLenderResolved = "DisputeLenderResolved",
}

export function contractStatusToLabelString(status: ContractStatus): string {
  switch (status) {
    case ContractStatus.Requested:
      return "Contract Requested";
    case ContractStatus.Approved:
      return "Contract Approved";
    case ContractStatus.CollateralSeen:
      return "Collateral Seen";
    case ContractStatus.CollateralConfirmed:
      return "Collateral Confirmed";
    case ContractStatus.PrincipalGiven:
      return "Principal Disbursed";
    case ContractStatus.Closing:
      return "Contract Closing";
    case ContractStatus.Repaid:
      return "Loan Repaid";
    case ContractStatus.Closed:
      return "Contract Closed";
    case ContractStatus.Rejected:
      return "Contract Rejected";
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
      return "Dispute in progress";
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      return "Dispute Resolved";
    default:
      return "Unknown Status";
  }
}

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
  borrower_loan_address: string;
}

export interface Contract {
  id: string;
  loan_amount: number;
  duration_months: number;
  created_at: Date;
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
}

export enum LoanAssetType {
  Usdc = "Usdc",
  Usdt = "Usdt",
}

export enum LoanAssetChain {
  Ethereum = "Ethereum",
  Polygon = "Polygon",
  Starknet = "Starknet",
}

export interface ClaimCollateralPsbtResponse {
  psbt: string;
  collateral_descriptor: string;
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

export enum TransactionType {
  Funding = "Funding",
  Dispute = "Dispute",
  PrincipalGiven = "PrincipalGiven",
  PrincipalRepaid = "PrincipalRepaid",
  Liquidation = "Liquidation",
  ClaimCollateral = "ClaimCollateral",
}

export interface LoanTransaction {
  txid: string;
  contract_id: string;
  transaction_type: TransactionType;
  timestamp: Date;
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
