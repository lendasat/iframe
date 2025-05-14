import { useSearchParams } from "react-router-dom";
import { LoanAsset, LoanAssetHelper } from "@frontend/ui-shared";
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
import { Slider } from "@frontend/shadcn";
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
import { DollarSign, Percent } from "lucide-react";

// Define the form schema with Zod
const loanFormSchema = z.object({
  loanAmount: z
    .string()
    .min(1, "Loan amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Loan amount must be greater than 0",
    }),
  assetType: z.string(),
  interestRate: z
    .string()
    .min(1, "Interest rate is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 20,
      {
        message: "Interest rate must be between 1% and 20%",
      },
    ),
  loanDuration: z
    .string()
    .min(1, "Duration is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 1, {
      message: "Duration must be at least 1 day",
    }),
  ltv: z
    .string()
    .min(1, "LTV rate is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 70,
      {
        message: "LTV rate must be between 1% and 70%",
      },
    ),
});

// TypeScript type for our form
type LoanFormValues = z.infer<typeof loanFormSchema>;

export default function LoanApplication() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize form with values from search params or defaults
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      loanAmount: searchParams.get("amount") || "1000",
      assetType: searchParams.get("asset") || LoanAsset.USDC_POL,
      interestRate: searchParams.get("interest") || "13.5",
      loanDuration: searchParams.get("duration") || "7",
      ltv: searchParams.get("ltv") || "50",
    },
  });

  // Get methods and values from form
  const { watch, setValue } = form;
  const formValues = watch();

  // Update search params whenever form values change
  const updateSearchParams = (name: string, value: string) => {
    setSearchParams((params) => {
      params.set(name, value);
      return params;
    });
  };

  // Handler for interest rate slider
  const onInterestRateChange = (interest: number[]) => {
    const rateString = interest[0].toString();
    setValue("interestRate", rateString);
    updateSearchParams("interest", rateString);
  };

  // Handler for LTV slider
  const onLtvChange = (ltv: number[]) => {
    const ltvString = ltv[0].toString();
    setValue("ltv", ltvString);
    updateSearchParams("ltv", ltvString);
  };

  const availableLoanAssets = LoanAssetHelper.all();

  return (
    <ScrollArea className="h-screen">
      <div className="container py-10 space-y-8 px-4">
        <Form {...form}>
          <form className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="loanAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How much do you wish to borrow?</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center max-w-2xl ">
                        <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
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

            {/* Loan Duration */}
            <FormField
              control={form.control}
              name="loanDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    For how long do you want to borrow? (days)
                  </FormLabel>
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

            {/* Interest Rate */}
            <FormField
              control={form.control}
              name="interestRate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Preferred interest rate (p.a. %)</FormLabel>
                    <div className="w-20">
                      <div className="relative flex items-center max-w-2xl ">
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={20}
                          step={0.5}
                          className="text-center"
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value);
                            updateSearchParams("interest", value);
                            // Keep the slider in sync with the input
                            const numValue = Number(value);
                            if (
                              !isNaN(numValue) &&
                              numValue >= 1 &&
                              numValue <= 20
                            ) {
                              onInterestRateChange([numValue]);
                            }
                          }}
                        />
                        <Percent className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                      </div>
                    </div>
                  </div>
                  <FormControl>
                    <Slider
                      value={[Number(field.value)]}
                      onValueChange={(val) => {
                        onInterestRateChange(val);
                      }}
                      min={1}
                      max={20}
                      step={0.5}
                      className="mt-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* LTV Slider */}
            <FormField
              control={form.control}
              name="ltv"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Loan-to-Value Ratio (%)</FormLabel>

                    <div className="w-20">
                      <div className="relative flex items-center max-w-2xl ">
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={70}
                          step={1}
                          className="text-center"
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value);
                            updateSearchParams("ltv", value);
                            // Keep the slider in sync with the input
                            const numValue = Number(value);
                            if (
                              !isNaN(numValue) &&
                              numValue >= 1 &&
                              numValue <= 70
                            ) {
                              onLtvChange([numValue]);
                            }
                          }}
                        />
                        <Percent className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                      </div>
                    </div>
                  </div>
                  <FormControl>
                    <Slider
                      value={[Number(field.value)]}
                      onValueChange={(val) => onLtvChange(val)}
                      min={1}
                      max={70}
                      step={1}
                      className="mt-2"
                    />
                  </FormControl>
                  <FormDescription>
                    The maximum percentage of your collateral's value you can
                    borrow.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
