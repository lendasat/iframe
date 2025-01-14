import type { SemVer } from "semver";

export interface User {
  id: number;
  name: string;
  email: string;
  verified: boolean;
  // TODO: this is for now borrower specific and it sucks that we share this type
  // I'll leave this for now, because it looks like the only way to have a specific borrower and lender user
  // is to duplicate the whole login logic
  used_referral_code?: string;
  personal_referral_code?: string;
  first_time_discount_rate: number;
  created_at: Date;
}

export interface Version {
  commit_hash: string;
  version: SemVer;
}

export interface LoginResponse {
  token: string;
  enabled_features: LoanFeature[];
  user: User;
  wallet_backup_data: WalletBackupData;
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
  BringinBankAccount = "bringin_bank_account",
  BitrefillDebitCard = "bitrefill_debit_card",
}

export interface MeResponse {
  user: User;
  enabled_features: LoanFeature[];
}

export interface WalletBackupData {
  passphrase_hash: string;
  mnemonic_ciphertext: string;
  network: string;
  xpub: string;
}
