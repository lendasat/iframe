import { InnerFiatLoanDetails, LoanFeature } from "@frontend/base-http-client";
import { LoanAsset, LoanPayout, LoanTransaction } from "@frontend/ui-shared";

export type PersonalReferralCode = {
  code: string;
  active: boolean;
  first_time_discount_rate_referee: number;
  first_time_commission_rate_referrer: number;
  commission_rate_referrer: number;
  created_at: string; // RFC 3339 date string - ideally we would convert this to a date, but it's not worth the effort
  expires_at: string; // RFC 3339 date string - ideally we would convert this to a date, but it's not worth the effort
};

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

export const isActionRequired = (status: ContractStatus) => {
  switch (status) {
    case ContractStatus.Requested:
    case ContractStatus.Undercollateralized:
    case ContractStatus.Defaulted:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.Rejected:
    case ContractStatus.Cancelled:
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RenewalRequested:
      return false;
    case ContractStatus.Approved:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      return true;
  }
};

export const isContractOpen = (status: ContractStatus) => {
  switch (status) {
    case ContractStatus.Requested:
    case ContractStatus.Undercollateralized:
    case ContractStatus.Defaulted:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.Extended:
    case ContractStatus.Rejected:
    case ContractStatus.Cancelled:
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
      return false;
    case ContractStatus.Approved:
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.PrincipalGiven:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.RenewalRequested:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
      return true;
  }
};

export const isContractClosed = (status: ContractStatus) => {
  return !isContractOpen(status);
};

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
    case ContractStatus.ApprovalExpired:
      return "Approval Expired";
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
    case ContractStatus.ApprovalExpired:
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

export interface BorrowerProfile {
  id: string;
  name: string;
}

export interface FiatLoanDetails {
  details: InnerFiatLoanDetails;
  encrypted_encryption_key_borrower: string;
  encrypted_encryption_key_lender: string;
}

export interface FiatLoanDetailsResponse {
  details: InnerFiatLoanDetails;
  encrypted_encryption_key: string;
}

export interface ContractRequest {
  id: string;
  loan_amount: number;
  duration_days: number;
  borrower_btc_address: string;
  borrower_npub: string;
  borrower_pk: string;
  borrower_derivation_path: string;
  borrower_loan_address?: string;
  loan_type: LoanType;
  moon_card_id?: string;
  fiat_loan_details?: FiatLoanDetails;
  client_contract_id?: string;
}

export interface Contract {
  id: string;
  loan_amount: number;
  duration_days: number;
  created_at: Date;
  updated_at: Date;
  repaid_at: Date | undefined;
  expiry: Date;
  interest: number;
  interest_rate: number;
  initial_collateral_sats: number;
  origination_fee_sats: number;
  collateral_sats: number;
  initial_ltv: number;
  loan_asset: LoanAsset;
  status: ContractStatus;
  liquidation_status: LiquidationStatus;
  lender: LenderStats;
  borrower_btc_address: string;
  loan_repayment_address: string;
  contract_address?: string;
  borrower_loan_address: string;
  transactions: LoanTransaction[];
  loan_type: LoanType;
  liquidation_price: number;
  extends_contract?: string;
  extended_by_contract?: string;
  kyc_info?: KycInfo;
  fiat_loan_details_borrower?: FiatLoanDetailsResponse;
  fiat_loan_details_lender?: FiatLoanDetailsResponse;
  lender_npub: string;
  borrower_pk: string;
  borrower_npub: string;
  borrower_derivation_path: string;
  timeline: TimelineEvent[];
  client_contract_id?: string;
}

export interface TimelineEvent {
  // TODO: this is a rfc3339 formatted date, but I failed to parse it correctly
  date: string;
  event: ContractStatus;
  txid?: string;
}

export interface KycInfo {
  kyc_link: string;
  is_kyc_done: boolean;
}

export interface ClaimCollateralPsbtResponse {
  psbt: string;
  collateral_descriptor: string;
  borrower_pk: string;
}

export interface LoanOffer {
  id: string;
  lender: LenderStats;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  duration_days_min: number;
  duration_days_max: number;
  loan_asset: LoanAsset;
  loan_payout: LoanPayout;
  origination_fee: OriginationFee[];
  extension_origination_fee: OriginationFee[];
  kyc_link?: string;
  lender_pk: string;
}

export interface PostLoanApplication {
  ltv: number;
  interest_rate: number;
  loan_amount: number;
  duration_days: number;
  loan_asset: LoanAsset;
  loan_type: LoanType;
  borrower_loan_address: string;
  borrower_btc_address: string;
  borrower_pk: string;
  borrower_derivation_path: string;
  borrower_npub: string;
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
  duration_days: number;
  loan_asset: LoanAsset;
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
  from_day: number;
  to_day: number;
  fee: number;
}

export class OriginationFeeHelper {
  static isRelevant(
    originationFee: OriginationFee,
    contractDuration: number,
  ): boolean {
    return (
      originationFee.from_day <= contractDuration &&
      originationFee.to_day > contractDuration
    );
  }
}

export function findBestOriginationFee(
  originationFees: OriginationFee[],
  contractDuration: number,
): number {
  const relevantFees = originationFees.filter((fee) =>
    OriginationFeeHelper.isRelevant(fee, contractDuration),
  );

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

// Warning: only change the string values if you know what you are doing.
// They are linked to the database and if changed some features might stop
// working.
export enum LoanProductOption {
  PayWithMoonDebitCard = "pay_with_moon",
  StableCoins = "stable_coins",
  Fiat = "fiat",
  Bringin = "bringin",
}

export class FeatureMapper {
  private static readonly FEATURE_MAP: Record<string, LoanProductOption> = {
    [LoanProductOption.StableCoins]: LoanProductOption.StableCoins,
    [LoanProductOption.PayWithMoonDebitCard]:
      LoanProductOption.PayWithMoonDebitCard,
    // Add other mappings once we use them
  };

  static mapEnabledFeatures(features: LoanFeature[]): LoanProductOption[] {
    return features.flatMap((feature) => {
      const mappedFeature = FeatureMapper.FEATURE_MAP[feature.id];
      return mappedFeature ? [mappedFeature] : [];
    });
  }
}

export enum LoanType {
  PayWithMoon = "PayWithMoon",
  StableCoin = "StableCoin",
  Fiat = "Fiat",
  Bringin = "Bringin",
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

export interface LoanApplication {
  loan_deal_id: string;
  borrower_id: string;
  ltv: number;
  interest_rate: number;
  loan_amount: number;
  duration_days: number;
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

export interface NotifyUser {
  contract_id: string;
}

// Enum for dispute initiator type
export enum DisputeInitiatorType {
  Borrower = "Borrower",
  Lender = "Lender",
}

// Enum for dispute status
export enum ContractDisputeStatus {
  DisputeStartedBorrower = "DisputeStartedBorrower",
  DisputeStartedLender = "DisputeStartedLender",
  InProgress = "InProgress",
  Closed = "Closed",
  Cancelled = "Cancelled",
}

// Enum for message sender type
export enum SenderType {
  Borrower = "Borrower",
  Lender = "Lender",
  PlatformAdmin = "PlatformAdmin",
}

// Interface for contract dispute
export interface ContractDispute {
  id: string;
  contract_id: string;
  initiator_type: DisputeInitiatorType;
  initiator_id: string;
  status: ContractDisputeStatus;
  reason: string;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  resolution_notes?: string;
}

// Interface for contract dispute message
export interface ContractDisputeMessage {
  id: string;
  dispute_id: string;
  sender_type: SenderType;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: Date;
}

// Interface that combines a dispute with its messages
export interface DisputeWithMessages extends ContractDispute {
  messages: ContractDisputeMessage[];
}

export interface MeResponse {
  user: User;
  enabled_features: LoanFeature[];
}

export interface PakeLoginResponse {
  salt: string;
  b_pub: string;
}

// We use this type to indicate that the caller attempting to log in
// must first upgrade to PAKE.
export interface MustUpgradeToPake {
  // We don't need a value to use the interface for control flow.
  must_upgrade_to_pake: undefined;
}

export interface LoginResponse {
  token: string;
  enabled_features: LoanFeature[];
  user: User;
  wallet_backup_data: WalletBackupData;
}

export type LoginResponseOrUpgrade = LoginResponse | MustUpgradeToPake;

export type PakeLoginResponseOrUpgrade = PakeLoginResponse | MustUpgradeToPake;

export interface PakeVerifyResponse {
  server_proof: string;
  token: string;
  enabled_features: LoanFeature[];
  user: User;
  wallet_backup_data: WalletBackupData;
}

export interface UpgradeToPakeResponse {
  old_wallet_backup_data: WalletBackupData;
  contract_pks: string[];
}

export interface Version {
  tag: string;
  commit_hash: string;
}

export interface WalletBackupData {
  mnemonic_ciphertext: string;
  network: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  // TODO: this is for now borrower specific and it sucks that we share this type
  used_referral_code?: string;
  personal_referral_codes?: PersonalReferralCode[];
  timezone?: string;
  first_time_discount_rate: number;
  created_at: Date;
  personal_telegram_token?: string;
}

export interface HasApiKey {
  has_key: boolean;
}

export interface BringinConnectResponse {
  signup_url?: string;
}
