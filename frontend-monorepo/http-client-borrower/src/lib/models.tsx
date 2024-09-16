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
    default:
      return "Unknown Status";
  }
}

export interface LenderProfile {
  name: string;
  rate: number;
  loans: number;
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
  collateral_sats: number;
  initial_ltv: number;
  status: ContractStatus;
  lender: LenderProfile;
  borrower_pk: string;
  borrower_btc_address: string;
  loan_repayment_address: string;
  contract_address?: string;
  borrower_loan_address: string;
}

export enum LoanAssetType {
  Usdc = "Usdc",
  Usdt = "Usdt",
}

export enum LoanAssetChain {
  Ethereum = "Ethereum",
  Starknet = "Starknet",
}

export interface ClaimCollateralPsbtResponse {
  psbt: string;
  collateral_descriptor: string;
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
