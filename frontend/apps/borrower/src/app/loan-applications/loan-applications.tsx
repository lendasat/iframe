import { useSearchParams } from "react-router-dom";
import { LoanAsset, LoanAssetHelper } from "@frontend/ui-shared";
import { LoanProductTypes } from "../loan-offers/loan-request-flow";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@frontend/shadcn";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import { ScrollArea } from "@frontend/shadcn";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@frontend/shadcn";
import { Confirmation } from "./confirmation";
import { DollarSign, Percent, Euro } from "lucide-react";
import { Currency } from "@frontend/ui-shared";

// Define the form schema with Zod
const loanFormSchema = z.object({
  loanAmountMin: z
    .string()
    .min(1, "Minimum loan amount is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: "Minimum loan amount must be greater than 0",
    }),
  loanAmountMax: z
    .string()
    .min(1, "Maximum loan amount is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: "Maximum loan amount must be greater than 0",
    }),
  assetType: z.string(),
  interestRate: z
    .string()
    .min(1, "Interest rate is required")
    .refine(
      (val) =>
        !Number.isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 20,
      {
        message: "Interest rate must be between 1% and 20%",
      },
    ),
  loanDurationMin: z
    .string()
    .min(1, "Minimum duration is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 1, {
      message: "Minimum duration must be at least 1 day",
    }),
  loanDurationMax: z
    .string()
    .min(1, "Maximum duration is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 1, {
      message: "Maximum duration must be at least 1 day",
    })
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) <= 1440, {
      message: "Maximum duration cannot exceed 1440 days",
    }),
  ltv: z
    .string()
    .min(1, "LTV rate is required")
    .refine(
      (val) =>
        !Number.isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 70,
      {
        message: "LTV rate must be between 1% and 70%",
      },
    ),
});

// TypeScript type for our form
type LoanFormValues = z.infer<typeof loanFormSchema>;

// Helper function to convert LoanProductTypes to LoanAsset
const getLoanAssetFromProductType = (productType: string): LoanAsset => {
  switch (productType) {
    case LoanProductTypes.Fiat:
      return LoanAsset.USD;
    case LoanProductTypes.StableCoins:
      return LoanAsset.USDC_POL;
    case LoanProductTypes.PayWithMoon:
    case LoanProductTypes.Bringin:
      return LoanAsset.USDC_POL;
    default:
      return LoanAsset.USDC_POL;
  }
};

export default function LoanApplication() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get loanAsset parameter and convert from LoanProductTypes if needed
  const loanAssetParam = searchParams.get("loanAsset");
  const defaultAsset = loanAssetParam
    ? getLoanAssetFromProductType(loanAssetParam)
    : (searchParams.get("asset") as LoanAsset) || LoanAsset.USDC_POL;

  // Initialize form with values from search params or defaults
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    mode: "onChange", // Validate on every change for real-time feedback
    defaultValues: {
      loanAmountMin: searchParams.get("amount") || "1000",
      loanAmountMax: searchParams.get("amount") || "1000",
      assetType: defaultAsset,
      interestRate: searchParams.get("interest") || "13.5",
      loanDurationMin: searchParams.get("durationMin") || "30",
      loanDurationMax: searchParams.get("durationMax") || "360",
      ltv: searchParams.get("ltv") || "50",
    },
  });

  // Get methods and values from form
  const { watch, formState } = form;
  const formValues = watch();
  const { isValid } = formState;

  // Update search params whenever form values change
  const updateSearchParams = (name: string, value: string) => {
    setSearchParams((params) => {
      params.set(name, value);
      return params;
    });
  };

  const availableLoanAssets = LoanAssetHelper.all();
  const selectedAsset = formValues.assetType as LoanAsset;
  const selectedCurrency = LoanAssetHelper.toCurrency(selectedAsset);

  return (
    <ScrollArea className="h-screen">
      <div className="space-y-8 px-4 py-10">
        <Form {...form}>
          <form className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-1">
              {/* Asset Type */}
              <FormField
                control={form.control}
                name="assetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What do you want to borrow?</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        updateSearchParams("assetType", value);
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select asset" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {availableLoanAssets.map((asset: LoanAsset) => (
                            <SelectItem key={asset.toString()} value={asset}>
                              {LoanAssetHelper.print(asset)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-6">
              <FormLabel>How much do you wish to borrow?</FormLabel>
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="loanAmountMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Minimum Amount</FormLabel>
                      <FormControl>
                        <div className="relative flex max-w-2xl items-center">
                          {selectedCurrency === Currency.EUR ? (
                            <Euro className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                          ) : (
                            <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                          )}
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            className="pl-6"
                            onChange={(e) => {
                              field.onChange(e);
                              updateSearchParams("amountMin", e.target.value);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="loanAmountMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Maximum Amount</FormLabel>
                      <FormControl>
                        <div className="relative flex max-w-2xl items-center">
                          {selectedCurrency === Currency.EUR ? (
                            <Euro className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                          ) : (
                            <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                          )}
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            className="pl-6"
                            onChange={(e) => {
                              field.onChange(e);
                              updateSearchParams("amountMax", e.target.value);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Loan Duration Range */}
            <div className="space-y-4">
              <FormLabel>
                How many days do you want your loan to last for?
              </FormLabel>
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="loanDurationMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Minimum Days</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          onChange={(e) => {
                            field.onChange(e);
                            updateSearchParams("durationMin", e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="loanDurationMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Maximum Days</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={1440}
                          onChange={(e) => {
                            field.onChange(e);
                            updateSearchParams("durationMax", e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Interest Rate and LTV */}
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred interest rate (p.a.)</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={20}
                          step={0.5}
                          className="pr-8"
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            updateSearchParams("interest", e.target.value);
                          }}
                        />
                        <Percent className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ltv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan-to-value ratio</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={70}
                          step={1}
                          className="pr-8"
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            updateSearchParams("ltv", e.target.value);
                          }}
                        />
                        <Percent className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        {/* Confirmation - only show when form is valid */}

        <Confirmation
          selectedAssetType={formValues.assetType as LoanAsset}
          selectedLoanDurationMin={formValues.loanDurationMin}
          selectedLoanDurationMax={formValues.loanDurationMax}
          selectedLoanAmountMin={formValues.loanAmountMin}
          selectedLoanAmountMax={formValues.loanAmountMax}
          selectedInterestRate={formValues.interestRate}
          originationFee={0.015}
          ltv={formValues.ltv}
          disabled={!isValid}
        />
      </div>
    </ScrollArea>
  );
}
