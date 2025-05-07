export interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  // TODO: this is for now borrower specific and it sucks that we share this type
  // I'll leave this for now, because it looks like the only way to have a specific borrower and lender user
  // is to duplicate the whole login logic
  used_referral_code?: string;
  // Only exists for the borrower
  personal_referral_codes?: PersonalReferralCode[];
  timezone?: string;
  first_time_discount_rate: number;
  created_at: Date;
  // TODO: This token currently only exists for lenders
  personal_telegram_token?: string;
}

export type PersonalReferralCode = {
  code: string;
  active: boolean;
  first_time_discount_rate_referee: number;
  first_time_commission_rate_referrer: number;
  commission_rate_referrer: number;
  created_at: string; // RFC 3339 date string - ideally we would convert this to a date, but it's not worth the effort
  expires_at: string; // RFC 3339 date string - ideally we would convert this to a date, but it's not worth the effort
};

export interface LoginResponse {
  token: string;
  enabled_features: LoanFeature[];
  user: User;
  wallet_backup_data: WalletBackupData;
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

export interface LoanFeature {
  id: string;
  name: string;
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

export interface MeResponse {
  user: User;
  enabled_features: LoanFeature[];
}

export interface WalletBackupData {
  mnemonic_ciphertext: string;
  network: string;
}

export interface IbanTransferDetails {
  iban: string;
  bic?: string;
}

export interface SwiftTransferDetails {
  swift_or_bic: string;
  account_number: string;
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
export interface FiatLoanDetails {
  details: InnerFiatLoanDetails;
  encrypted_encryption_key_borrower: string;
  encrypted_encryption_key_lender: string;
}

export interface FiatLoanDetailsResponse {
  details: InnerFiatLoanDetails;
  encrypted_encryption_key: string;
}

export interface Version {
  tag: string;
  commit_hash: string;
}

export interface IsRegisteredResponse {
  is_registered: boolean;
  is_verified: boolean;
}
