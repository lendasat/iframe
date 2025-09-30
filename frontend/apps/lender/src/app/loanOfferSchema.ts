import { z } from "zod";
import { LoanAsset, ONE_YEAR } from "@frontend/ui-shared";

// Define the schema for loan offers
export const loanOfferSchema = z
  .object({
    loanAmount: z
      .object({
        min: z.number().min(1, "Minimum amount must be at least 1"),
        max: z.number().min(1, "Maximum amount must be at least 1"),
      })
      .refine((data) => data.max >= data.min, {
        message:
          "Maximum amount must be greater than or equal to minimum amount",
        path: ["max"],
      }),

    autoAccept: z.boolean(),

    ltv: z
      .number()
      .min(1, "LTV must be at least 1%")
      .max(70, "LTV cannot exceed 70%"),

    interest: z
      .number()
      .min(0, "Interest rate cannot be negative")
      .max(100, "Interest rate cannot exceed 100%"),

    loanAsset: z
      .string()
      .refine((val) => Object.values(LoanAsset).includes(val as LoanAsset), {
        message: "Invalid loan asset selected",
      }),

    loanRepaymentAddress: z.string().optional(),

    loanDuration: z
      .object({
        min: z
          .number({
            required_error: "Minimum duration is required",
            invalid_type_error: "Minimum duration must be a number",
          })
          .min(7, "Minimum duration must be at least 7 days")
          .max(ONE_YEAR * 4, "Maximum duration cannot exceed 4 years"),
        max: z
          .number({
            required_error: "Maximum duration is required",
            invalid_type_error: "Maximum duration must be a number",
          })
          .min(7, "Maximum duration must be at least 7 days")
          .max(ONE_YEAR * 4, "Maximum duration cannot exceed 4 years"),
      })
      .refine((data) => data.max >= data.min, {
        message:
          "Maximum duration must be greater than or equal to minimum duration",
        path: ["max"],
      }),

    extension_enabled: z.boolean(),

    extension_duration_days: z
      .number()
      .min(0, "Extension duration must be at least 0")
      .max(ONE_YEAR, "Max loan duration at the moment is one year"),

    extension_interest_rate: z
      .number()
      .min(0, "Interest rate cannot be negative")
      .max(100, "Interest rate cannot exceed 100%"),

    isKycRequired: z.boolean(),

    kycLink: z.union([
      z.string().url("Please enter a valid URL"),
      z.string().length(0),
    ]),
  })
  .refine(
    (data) => {
      // If KYC is required, then KYC link should be provided
      if (data.isKycRequired && (!data.kycLink || data.kycLink.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "KYC link is required when KYC is enabled",
      path: ["kycLink"], // Path to the field that has the error
    },
  );

// Export the type
export type LoanOfferFormValues = z.infer<typeof loanOfferSchema>;

// Default values for the form
export const defaultLoanOfferValues: LoanOfferFormValues = {
  loanAmount: {
    min: 1000,
    max: 100000,
  },
  autoAccept: false,
  ltv: 50,
  interest: 7.5,
  loanAsset: LoanAsset.USDT_ETH,
  loanRepaymentAddress: "",
  loanDuration: {
    min: 7,
    max: 180, // 6 months
  },
  isKycRequired: false,
  kycLink: "",
  extension_enabled: true,
  extension_duration_days: 7,
  extension_interest_rate: 7.5,
};
