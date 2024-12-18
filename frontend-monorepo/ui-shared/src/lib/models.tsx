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

export enum LoanAssetType {
  Usdc = "Usdc",
  Usdt = "Usdt",
}

export enum LoanAssetChain {
  Ethereum = "Ethereum",
  Polygon = "Polygon",
  Starknet = "Starknet",
}
