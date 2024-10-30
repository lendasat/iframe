import type { SemVer } from "semver";

export interface User {
  id: number;
  name: string;
  email: string;
  verified: boolean;
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
