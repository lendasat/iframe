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

export interface Contract {
  id: string;
  lender_id: string;
  borrower_id: string;
  loan_id: string;
  initial_ltv: number;
  initial_collateral_sats: number;
  loan_amount: number;
  interest_rate: number;
  duration_months: number;
  borrower_btc_address: string;
  borrower_pk: string;
  loan_repayment_address: string;
  contract_address?: string;
  borrower_loan_address: string;
  status: ContractStatus;
  contract_index: number;
  collateral_output: string;
  claim_txid: string;
  created_at: Date;
  updated_at: Date | undefined;
}

export enum LoanAssetType {
  Usdc = "Usdc",
  Usdt = "Usdt",
}

export enum LoanAssetChain {
  Ethereum = "Ethereum",
  Starknet = "Starknet",
}

export interface CreateLoanOfferRequest {
  name: string;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  duration_months_min: number;
  duration_months_max: number;
  loan_asset_type: LoanAssetType;
  loan_asset_chain: LoanAssetChain;
  loan_repayment_address: string;
}

export interface LoanOffer {
  id: string;
  lender_id: string;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  duration_months_min: number;
  duration_months_max: number;
  loan_asset_type: string;
  loan_asset_chain: string;
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
