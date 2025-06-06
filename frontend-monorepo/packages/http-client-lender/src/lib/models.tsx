import { LoanAsset, LoanPayout, LoanTransaction } from "@frontend/ui-shared";

export interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  timezone?: string;
  first_time_discount_rate: number;
  created_at: Date;
  personal_telegram_token?: string;
}

export interface WalletBackupData {
  mnemonic_ciphertext: string;
  network: string;
}

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
  ClosedByLiquidation = "ClosedByLiquidation",
  ClosedByDefaulting = "ClosedByDefaulting",
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
    case ContractStatus.Approved:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.ClosedByDefaulting:
    case ContractStatus.ClosedByLiquidation:
    case ContractStatus.Extended:
    case ContractStatus.Rejected:
    case ContractStatus.Cancelled:
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
    case ContractStatus.CollateralSeen:
    case ContractStatus.PrincipalGiven:
      return false;
    case ContractStatus.Requested:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.Undercollateralized:
    case ContractStatus.Defaulted:
    case ContractStatus.CollateralConfirmed:
    case ContractStatus.RepaymentProvided:
    case ContractStatus.RenewalRequested:
      return true;
  }
};

export const isContractOpen = (status: ContractStatus) => {
  switch (status) {
    case ContractStatus.Requested:
    case ContractStatus.Undercollateralized:
    case ContractStatus.Closing:
    case ContractStatus.Closed:
    case ContractStatus.ClosedByLiquidation:
    case ContractStatus.ClosedByDefaulting:
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
    case ContractStatus.Defaulted:
      return true;
  }
};

export const isContractClosed = (status: ContractStatus) => {
  return !isContractOpen(status);
};

export const ALL_CONTRACT_STATUSES = Object.values(
  ContractStatus,
) as ContractStatus[];

export interface Contract {
  id: string;
  loan_amount: number;
  duration_days: number;
  created_at: Date;
  updated_at: Date;
  expiry: Date;
  interest_rate: number;
  interest: number;
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
  timeline: TimelineEvent[];
  extension_max_duration_days: number;
  extension_interest_rate?: number;
  installments: Installment[];
}

export interface Installment {
  id: string;
  principal: number;
  interest: number;
  due_date: Date;
  status: InstallmentStatus;
  paid_date?: Date;
  payment_id?: string;
}

export enum InstallmentStatus {
  Pending = "pending",
  Paid = "paid",
  Confirmed = "confirmed",
  Late = "late",
  Cancelled = "cancelled",
}

export interface TimelineEvent {
  event: TimelineEventKind;
  // TXID of the transaction (or transfer) associated with this event.
  txid?: string;
  // TODO: This is an RFC3339 formatted date, but I failed to parse it correctly.
  date: string;
}

export interface TimelineEventKind {
  type: TimelineEventType;
  // Associated contract status event, if it applies.
  status?: ContractStatus;
  // Is the installment confirmed, if it applies.
  is_confirmed?: boolean;
}

export enum TimelineEventType {
  ContractStatusChange = "contract_status_change",
  Installment = "installment",
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
  loan_payout: LoanPayout;
  loan_repayment_address: string;
  auto_accept: boolean;
  lender_npub: string;
  lender_pk: string;
  lender_derivation_path: string;
  kyc_link?: string;
  extension_duration_days?: number;
  extension_interest_rate?: number;
  repayment_plan: RepaymentPlan;
}

export enum RepaymentPlan {
  Bullet = "bullet",
  InterestOnlyWeekly = "interest_only_weekly",
  InterestOnlyMonthly = "interest_only_monthly",
}

export function repaymentPlanLabel(plan: RepaymentPlan): string {
  switch (plan) {
    case RepaymentPlan.InterestOnlyMonthly:
      return "Interest-Only Monthly";
    case RepaymentPlan.InterestOnlyWeekly:
      return "Interest-Only Weekly";
    case RepaymentPlan.Bullet:
      return "Bullet";
  }
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
  loan_payout: LoanPayout;
  origination_fee: OriginationFee[];
  status: LoanOfferStatus;
  auto_accept: boolean;
  kyc_link?: string;
  extension_max_duration_days: number;
  extension_interest_rate?: number;
  repayment_plan: RepaymentPlan;
  created_at: Date;
  updated_at: Date;
}

export const actionFromStatus = (contract: Contract) => {
  const hasPaidInstallments =
    contract.installments.filter((i) => {
      return i.status === InstallmentStatus.Paid;
    }).length !== 0;

  let statusText = "";
  switch (contract.status) {
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
    case ContractStatus.PrincipalGiven:
      statusText = hasPaidInstallments ? "Confirm repayment" : "Details";
      break;
    case ContractStatus.Approved:
    case ContractStatus.Rejected:
    case ContractStatus.RequestExpired:
    case ContractStatus.ApprovalExpired:
    case ContractStatus.CollateralSeen:
    case ContractStatus.RepaymentConfirmed:
    case ContractStatus.DisputeBorrowerStarted:
    case ContractStatus.DisputeLenderStarted:
    case ContractStatus.DisputeBorrowerResolved:
    case ContractStatus.DisputeLenderResolved:
    case ContractStatus.Closed:
    case ContractStatus.ClosedByLiquidation:
    case ContractStatus.ClosedByDefaulting:
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
      statusText = "Open";
      break;
    case ContractStatus.RepaymentProvided:
      statusText = "Repayment Provided";
      break;
    case ContractStatus.RepaymentConfirmed:
      statusText = "Repayment Confirmed";
      break;
    case ContractStatus.Undercollateralized:
      statusText = "Awaiting Liquidation";
      break;
    case ContractStatus.Defaulted:
      statusText = "Defaulted";
      break;
    case ContractStatus.Closing:
      statusText = "Closing";
      break;
    case ContractStatus.Closed:
      statusText = "Closed by repayment";
      break;
    case ContractStatus.ClosedByDefaulting:
      statusText = "Closed by defaulting";
      break;
    case ContractStatus.ClosedByLiquidation:
      statusText = "Closed by liquidation";
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
  InstallmentPaid = "InstallmentPaid",
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
  borrower_pk: string;
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
  fiat_loan_details?: FiatLoanDetails;
}

export interface NotifyUser {
  contract_id: string;
}

// Enum for message sender type
export enum SenderType {
  Borrower = "Borrower",
  Lender = "Lender",
  PlatformAdmin = "PlatformAdmin",
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

export interface ExtensionPolicy {
  extension_max_duration_days: number;
  extension_interest_rate: number;
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

export interface InnerFiatLoanDetails {
  iban_transfer_details?: IbanTransferDetails;
  swift_transfer_details?: SwiftTransferDetails;
  bank_name: string;
  bank_address: string;
  bank_country: string;
  purpose_of_remittance: string;
  full_name: string;
  address: string;
  city: string;
  post_code: string;
  country: string;
  comments?: string;
}

export interface IbanTransferDetails {
  iban: string;
  bic?: string;
}

export interface SwiftTransferDetails {
  swift_or_bic: string;
  account_number: string;
}

// We use this type to indicate that the caller attempting to log in
// must first upgrade to PAKE.
export interface MustUpgradeToPake {
  // We don't need a value to use the interface for control flow.
  must_upgrade_to_pake: undefined;
}

export interface LoginResponse {
  token: string;
  enabled_features: LenderFeatureFlags[];
  user: User;
  wallet_backup_data: WalletBackupData;
}

export interface LoanFeature {
  id: string;
  name: string;
}

export interface Version {
  tag: string;
  commit_hash: string;
}

export interface MeResponse {
  user: User;
  enabled_features: LoanFeature[];
}

export interface LoginResponse {
  token: string;
  enabled_features: LenderFeatureFlags[];
  user: User;
  wallet_backup_data: WalletBackupData;
}

export interface PakeLoginResponse {
  salt: string;
  b_pub: string;
}

export interface UpgradeToPakeResponse {
  old_wallet_backup_data: WalletBackupData;
  contract_pks: string[];
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

export interface IsRegisteredResponse {
  is_registered: boolean;
  is_verified: boolean;
}

export enum NotificationMessageType {
  ContractUpdate = "ContractUpdate",
  InstallmentUpdate = "InstallmentUpdate",
  ChatMessage = "ChatMessage",
}

export interface NotificationMessage {
  type: NotificationMessageType;
  data: ContractUpdate | InstallmentUpdate | ChatMessage;
}

export interface ContractUpdate {
  id: string;
  contract_id: string;
  timestamp: string;
  status: ContractStatus;
  read: boolean;
}

export interface InstallmentUpdate {
  id: string;
  installment_id: string;
  contract_id: string;
  timestamp: string;
  status: InstallmentStatus;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  contract_id: string;
  borrower_name: string;
  timestamp: string;
  read: boolean;
}

export interface PaginatedNotificationResponse {
  data: NotificationMessage[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
