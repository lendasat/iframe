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
  FormDescription,
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
  loanAmount: z
    .string()
    .min(1, "Loan amount is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: "Loan amount must be greater than 0",
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
  loanDuration: z
    .string()
    .min(1, "Duration is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 1, {
      message: "Duration must be at least 1 day",
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
    case LoanProductTypes.Any:
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
    defaultValues: {
      loanAmount: searchParams.get("amount") || "1000",
      assetType: defaultAsset,
      interestRate: searchParams.get("interest") || "13.5",
      loanDuration: searchParams.get("duration") || "7",
      ltv: searchParams.get("ltv") || "50",
    },
  });

  // Get methods and values from form
  const { watch } = form;
  const formValues = watch();

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
      <div className="space-y-8 px-4 py-10 pb-20">
        <Form {...form}>
          <form className="space-y-8">
            {/* First Row: Amount, Duration, Asset Type */}
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
              <FormField
                control={form.control}
                name="loanAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
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
                            updateSearchParams("amount", e.target.value);
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
                name="loanDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (days)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        onChange={(e) => {
                          field.onChange(e);
                          updateSearchParams("duration", e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset</FormLabel>
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

            {/* Second Row: Interest Rate and LTV */}
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest rate (% p.a.)</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={20}
                          step={0.5}
                          className="pr-6"
                          onChange={(e) => {
                            field.onChange(e);
                            updateSearchParams("interest", e.target.value);
                          }}
                        />
                        <Percent className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Annual interest rate for your loan
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ltv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LTV (%)</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={70}
                          step={1}
                          className="pr-6"
                          onChange={(e) => {
                            field.onChange(e);
                            updateSearchParams("ltv", e.target.value);
                          }}
                        />
                        <Percent className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                      </div>
                    </FormControl>
                    <FormDescription>
                      The maximum percentage of your collateral's value you can
                      borrow.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        {/* Confirmation */}
        <Confirmation
          selectedAssetType={formValues.assetType as LoanAsset}
          selectedLoanDuration={formValues.loanDuration}
          selectedLoanAmount={formValues.loanAmount}
          selectedInterestRate={formValues.interestRate}
          originationFee={0.015}
          ltv={formValues.ltv}
        />
      </div>
    </ScrollArea>
  );
}
