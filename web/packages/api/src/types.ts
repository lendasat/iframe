import type { components } from "./openapi/schema";
import { parseISO } from "date-fns";

// Referral Code types
export interface PersonalReferralCode {
  active: boolean;
  code: string;
  commissionRateReferrer: number;
  createdAt: Date;
  expiresAt: Date;
  firstTimeCommissionRateReferrer: number;
}

// Loan Feature types
export interface LoanFeature {
  id: string;
  name: string;
}

// User types
export interface User {
  createdAt: Date;
  email: string;
  firstTimeDiscountRate: number;
  id: string;
  locale?: string | null;
  name: string;
  personalReferralCodes: PersonalReferralCode[];
  personalTelegramToken: string;
  timezone?: string | null;
  totpEnabled: boolean;
  updatedAt: Date;
  usedReferralCode?: string | null;
  verified: boolean;
}

// Me Response type
export interface MeResponse {
  enabledFeatures: LoanFeature[];
  user: User;
}

// Mapper functions to convert schema types to our custom types
export function mapPersonalReferralCode(
  code: components["schemas"]["PersonalReferralCodeResponse"],
): PersonalReferralCode {
  return {
    active: code.active,
    code: code.code,
    commissionRateReferrer: code.commission_rate_referrer,
    createdAt: parseISO(code.created_at),
    expiresAt: parseISO(code.expires_at),
    firstTimeCommissionRateReferrer: code.first_time_commission_rate_referrer,
  };
}

export function mapLoanFeature(
  feature: components["schemas"]["BorrowerLoanFeatureResponse"],
): LoanFeature {
  return {
    id: feature.id,
    name: feature.name,
  };
}

export function mapUser(user: components["schemas"]["FilteredUser"]): User {
  return {
    createdAt: parseISO(user.created_at),
    email: user.email,
    firstTimeDiscountRate: user.first_time_discount_rate,
    id: user.id,
    locale: user.locale,
    name: user.name,
    personalReferralCodes: user.personal_referral_codes.map(
      mapPersonalReferralCode,
    ),
    personalTelegramToken: user.personal_telegram_token,
    timezone: user.timezone,
    totpEnabled: user.totp_enabled,
    updatedAt: parseISO(user.updated_at),
    usedReferralCode: user.used_referral_code,
    verified: user.verified,
  };
}

export function mapMeResponse(
  response: components["schemas"]["MeResponse"],
): MeResponse {
  return {
    enabledFeatures: response.enabled_features.map(mapLoanFeature),
    user: mapUser(response.user),
  };
}
