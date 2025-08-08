import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/shadcn/src";
import {
  Badge,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
} from "@frontend/shadcn";
import { toast } from "sonner";
import {
  LoanAsset,
  LoanAssetHelper,
  LoanPayout,
  ONE_YEAR,
} from "@frontend/ui-shared";
import {
  CreateLoanOfferRequest,
  RepaymentPlan,
  repaymentPlanLabel,
} from "@frontend/http-client-lender";
import { LoanAssetDescription } from "@frontend/ui-shared/src/lib/loan-asset-info";
import {
  Calendar,
  Clock,
  CreditCard,
  DollarSign,
  Link as LinkIcon,
  Percent,
  Settings,
  Shield,
  User,
} from "lucide-react";

const formSchema = z
  .object({
    min_ltv: z.number().min(1).max(100, "LTV must be between 0 and 100"),
    interest_rate: z.number().min(0.5, "Interest rate must be positive"),
    loan_amount_min: z.number().int().min(1, "Minimum loan amount must be > 1"),
    loan_amount_max: z.number().int().min(1, "Maximum loan amount must be > 1"),
    loan_amount_reserve: z.number().min(1, "Reserve amount must be > 1"),
    duration_days_min: z
      .number({
        required_error: "Minimum duration is required",
        invalid_type_error: "Minimum duration must be a number",
      })
      .int()
      .min(7, "Minimum duration must be at least 7 days")
      .max(4 * ONE_YEAR, "Maximum duration cannot exceed 4 years"),
    duration_days_max: z
      .number({
        required_error: "Maximum duration is required",
        invalid_type_error: "Maximum duration must be a number",
      })
      .int()
      .min(7, "Maximum duration must be at least 7 days")
      .max(4 * ONE_YEAR, "Maximum duration cannot exceed 4 years"),
    loan_asset: z.nativeEnum(LoanAsset),
    loan_payout: z.nativeEnum(LoanPayout),
    loan_repayment_address: z.string().min(1, "Repayment address is required"),
    auto_accept: z.boolean(),
    kyc_link: z
      .string()
      .url("Must be a valid URL")
      .optional()
      .or(z.literal("")),
    extension_duration_days: z.number().int().min(0).optional(),
    repayment_plan: z.nativeEnum(RepaymentPlan),
  })
  .refine((data) => data.loan_amount_max >= data.loan_amount_min, {
    message:
      "Maximum loan amount must be greater than or equal to minimum loan amount",
    path: ["loan_amount_max"],
  })
  .refine((data) => data.duration_days_max >= data.duration_days_min, {
    message:
      "Maximum duration must be greater than or equal to minimum duration",
    path: ["duration_days_max"],
  })
  .refine((data) => data.loan_amount_reserve >= data.loan_amount_max, {
    message:
      "Reserve amount must be greater than or equal to maximum loan amount",
    path: ["loan_amount_reserve"],
  });

type FormData = z.infer<typeof formSchema>;

interface CreateLoanOfferFormProps {
  onSubmit: (data: CreateLoanOfferRequest) => void;
  autoApproveEnabled: boolean;
  kycOffersEnabled: boolean;
}

export function CreateLoanOfferForm({
  onSubmit,
  autoApproveEnabled,
  kycOffersEnabled,
}: CreateLoanOfferFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      min_ltv: 70,
      interest_rate: 8,
      loan_amount_min: 1000,
      loan_amount_max: 100000,
      loan_amount_reserve: 100000,
      duration_days_min: 7,
      duration_days_max: 360,
      loan_asset: LoanAsset.USDC_POL,
      loan_payout: LoanPayout.Direct,
      loan_repayment_address: "",
      auto_accept: false,
      kyc_link: "",
      extension_duration_days: undefined,
      repayment_plan: RepaymentPlan.Bullet,
    },
  });

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const submitData: CreateLoanOfferRequest = {
        name: "Standard Loan Offer",
        min_ltv: data.min_ltv,
        interest_rate: data.interest_rate,
        loan_amount_min: data.loan_amount_min,
        loan_amount_max: data.loan_amount_max,
        loan_amount_reserve: data.loan_amount_reserve,
        duration_days_min: data.duration_days_min,
        duration_days_max: data.duration_days_max,
        loan_asset: data.loan_asset,
        loan_payout: data.loan_payout,
        loan_repayment_address: data.loan_repayment_address,
        lender_pk: "", // Auto-generated and will be overwritten
        lender_derivation_path: "", // Auto-generated and will be overwritten
        auto_accept: data.auto_accept,
        kyc_link: data.kyc_link || undefined,
        lender_npub: "", // Auto-generated and will be overwritten
        extension_duration_days: data.extension_duration_days,
        extension_interest_rate: data.extension_duration_days
          ? data.interest_rate
          : undefined,
        repayment_plan: data.repayment_plan,
      };

      onSubmit(submitData);

      toast.success("Loan offer created successfully");

      form.reset();
    } catch (error) {
      toast.error("Error creating loan offer", {
        description: "Please check your inputs and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollArea className="h-screen">
      <div className="mx-auto space-y-6 p-6 pb-20">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="text-primary h-5 w-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  General details about your loan offer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="loan_asset"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loan Asset</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select asset" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LoanAssetHelper.all().map((asset) => (
                              <SelectItem key={asset} value={asset}>
                                {LoanAssetHelper.print(asset)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          <LoanAssetDescription asset={field.value} />
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repayment_plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repayment Plan</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select repayment plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={RepaymentPlan.Bullet}>
                              {repaymentPlanLabel(RepaymentPlan.Bullet)}
                            </SelectItem>
                            <SelectItem
                              value={RepaymentPlan.InterestOnlyMonthly}
                            >
                              {repaymentPlanLabel(
                                RepaymentPlan.InterestOnlyMonthly,
                              )}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {field.value === RepaymentPlan.Bullet &&
                            "Full principal and interest paid at the end of the loan term in a single payment."}
                          {field.value === RepaymentPlan.InterestOnlyMonthly &&
                            "Monthly interest payments throughout the loan term, with principal paid at maturity."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Financial Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="text-financial-green h-5 w-5" />
                  Financial Terms
                </CardTitle>
                <CardDescription>
                  Set your lending amounts, rates, and loan-to-value
                  requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="loan_amount_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Loan Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^\d*$/.test(value)) {
                                field.onChange(
                                  value === "" ? 0 : parseInt(value),
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="loan_amount_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Loan Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^\d*$/.test(value)) {
                                const newValue =
                                  value === "" ? 0 : parseInt(value);
                                field.onChange(newValue);

                                // Auto-update reserve amount if it's less than max loan amount
                                const currentReserve = form.getValues(
                                  "loan_amount_reserve",
                                );
                                if (currentReserve < newValue) {
                                  form.setValue(
                                    "loan_amount_reserve",
                                    newValue,
                                  );
                                }
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="loan_amount_reserve"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reserve Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "" || /^\d*$/.test(value)) {
                              field.onChange(
                                value === "" ? 0 : parseInt(value),
                              );
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Max amount to lend across all requests for this offer.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="interest_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          Annual Interest Rate (%)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g., 12.5"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^\d*\.?\d*$/.test(value)) {
                                field.onChange(
                                  value === "" ? 0 : parseFloat(value),
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Interest rate charged annually on the loan amount.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="min_ltv"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum LTV (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g., 70"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^\d*\.?\d*$/.test(value)) {
                                const numValue =
                                  value === "" ? 0 : parseFloat(value);
                                if (numValue <= 100) {
                                  field.onChange(numValue);
                                }
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum loan-to-value ratio
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Duration Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="text-financial-blue h-5 w-5" />
                  Duration Terms
                </CardTitle>
                <CardDescription>
                  Set loan duration limits (7 days to 4 years) and extension
                  options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="duration_days_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Duration (Days)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^\d*$/.test(value)) {
                                field.onChange(
                                  value === "" ? 7 : parseInt(value),
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration_days_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Duration (Days)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^\d*$/.test(value)) {
                                field.onChange(
                                  value === "" ? 7 : parseInt(value),
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="text-muted-foreground h-4 w-4" />
                    <h4 className="text-sm font-medium">Extension Options</h4>
                    <Badge variant="secondary">Optional</Badge>
                  </div>

                  <FormField
                    control={form.control}
                    name="extension_duration_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extension Duration (Days)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Optional"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^\d*$/.test(value)) {
                                field.onChange(
                                  value === "" ? undefined : parseInt(value),
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          If set, the borrower can extend the loan for{" "}
                          {field.value ? field.value : "n"} days.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Lender Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="text-financial-gold h-5 w-5" />
                  Lender Information
                </CardTitle>
                <CardDescription>
                  Your wallet and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="loan_repayment_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Repayment Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter repayment wallet address"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Address where loan repayments will be sent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {kycOffersEnabled && (
                  <FormField
                    control={form.control}
                    name="kyc_link"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4" />
                          KYC Link
                          <Badge variant="secondary">Optional</Badge>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://example.com/kyc"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional KYC process link for borrowers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Settings */}

            {autoApproveEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="text-destructive h-5 w-5" />
                    Offer Settings
                  </CardTitle>
                  <CardDescription>
                    Configure automatic acceptance and other preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="auto_accept"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Auto Accept
                          </FormLabel>
                          <FormDescription>
                            Automatically accept loan requests that meet your
                            criteria
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={isSubmitting}
              >
                Reset Form
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? "Creating..." : "Create Loan Offer"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </ScrollArea>
  );
}
