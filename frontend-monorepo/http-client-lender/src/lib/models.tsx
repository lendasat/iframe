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

export interface Contract {
  id: string;
  lender_id: string;
  borrower_id: string;
  loan_id: string;
  initial_ltv: number;
  initial_collateral_sats: number;
  loan_amount: number;
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
  updated_at: Date;
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
