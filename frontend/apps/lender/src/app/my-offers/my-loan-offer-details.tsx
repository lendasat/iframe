import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useAsync } from "react-use";
import { toast } from "sonner";

import {
  LoanOfferStatus,
  UpdateLoanOfferRequest,
  repaymentPlanLabel,
  useLenderHttpClient,
  useAuth,
  LenderFeatureFlags,
} from "@frontend/http-client-lender";
import {
  formatCurrency,
  LoanAssetHelper,
  LoanAddressInputField,
  ONE_YEAR,
} from "@frontend/ui-shared";
import { LoanAssetDescription } from "@frontend/ui-shared/src/lib/loan-asset-info";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ScrollArea,
  Separator,
  Switch,
} from "@frontend/shadcn";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";

import {
  AlertTriangle,
  Calendar,
  Clock,
  CreditCard,
  DollarSign,
  Edit3,
  Link as LinkIcon,
  Percent,
  Save,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";

import ReceipImg from "./../../assets/receipt_img.png";

const editFormSchema = z
  .object({
    min_ltv: z
      .number()
      .min(1)
      .max(100, "LTV must be between 1 and 100")
      .optional(),
    interest_rate: z
      .number()
      .min(0.5, "Interest rate must be positive")
      .max(100, "Interest rate must be between 0.5% and 100%")
      .optional(),
    loan_amount_min: z
      .number()
      .int()
      .min(1, "Minimum loan amount must be > 10")
      .optional(),
    loan_amount_max: z
      .number()
      .int()
      .min(1, "Maximum loan amount must be > 10")
      .optional(),
    loan_amount_reserve: z
      .number()
      .min(1, "Reserve amount must be > 10")
      .optional(),
    duration_days_min: z
      .number({
        required_error: "Minimum duration is required",
        invalid_type_error: "Minimum duration must be a number",
      })
      .int()
      .min(7, "Minimum duration must be at least 7 days")
      .max(4 * ONE_YEAR, "Maximum duration cannot exceed 4 years")
      .optional(),
    duration_days_max: z
      .number({
        required_error: "Maximum duration is required",
        invalid_type_error: "Maximum duration must be a number",
      })
      .int()
      .min(7, "Maximum duration must be at least 7 days")
      .max(4 * ONE_YEAR, "Maximum duration cannot exceed 4 years")
      .optional(),
    auto_accept: z.boolean().optional(),
    loan_repayment_address: z
      .string()
      .min(1, "Repayment address is required")
      .optional(),
    btc_loan_repayment_address: z.string().optional().or(z.literal("")),
    extension_duration_days: z.number().int().min(0).optional(),
    extension_interest_rate: z
      .number()
      .min(0.5, "Extension interest rate must be positive")
      .optional(),
    kyc_link: z
      .string()
      .url("Must be a valid URL")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) =>
      !data.loan_amount_max ||
      !data.loan_amount_min ||
      data.loan_amount_max >= data.loan_amount_min,
    {
      message:
        "Maximum loan amount must be greater than or equal to minimum loan amount",
      path: ["loan_amount_max"],
    },
  )
  .refine(
    (data) =>
      !data.duration_days_max ||
      !data.duration_days_min ||
      data.duration_days_max >= data.duration_days_min,
    {
      message:
        "Maximum duration must be greater than or equal to minimum duration",
      path: ["duration_days_max"],
    },
  )
  .refine(
    (data) =>
      !data.loan_amount_reserve ||
      !data.loan_amount_max ||
      data.loan_amount_reserve >= data.loan_amount_max,
    {
      message:
        "Reserve amount must be greater than or equal to maximum loan amount",
      path: ["loan_amount_reserve"],
    },
  );

type EditFormData = z.infer<typeof editFormSchema>;

function MyLoanOfferDetails() {
  const { getMyLoanOffer, updateLoanOffer, deleteLoanOffer } =
    useLenderHttpClient();
  const { id } = useParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { enabledFeatures } = useAuth();

  const autoApproveEnabled = enabledFeatures.includes(
    LenderFeatureFlags.AutoApproveLoanRequests,
  );
  const kycOffersEnabled = enabledFeatures.includes(
    LenderFeatureFlags.KycOffers,
  );

  const {
    value: offer,
    error: loadingError,
    loading: offerLoading,
  } = useAsync(async () => {
    if (id) {
      return getMyLoanOffer(id);
    } else {
      return undefined;
    }
  }, [id]);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    values: offer
      ? {
          min_ltv: offer.min_ltv * 100, // Convert from decimal to percentage
          interest_rate: offer.interest_rate * 100, // Convert from decimal to percentage
          loan_amount_min: offer.loan_amount_min,
          loan_amount_max: offer.loan_amount_max,
          loan_amount_reserve: offer.loan_amount_reserve,
          duration_days_min: offer.duration_days_min,
          duration_days_max: offer.duration_days_max,
          auto_accept: offer.auto_accept,
          loan_repayment_address: offer.loan_repayment_address,
          btc_loan_repayment_address: offer.btc_loan_repayment_address || "",
          extension_duration_days:
            offer.extension_max_duration_days > 0
              ? offer.extension_max_duration_days
              : undefined,
          extension_interest_rate: offer.extension_interest_rate
            ? offer.extension_interest_rate * 100
            : undefined,
          kyc_link: offer.kyc_link || "",
        }
      : undefined,
  });

  if (loadingError || (!offer && !offerLoading)) {
    return (
      <div className="flex h-[calc(100vh-130px)] flex-col items-center justify-center gap-y-4 px-5 text-center">
        <div className="bg-background flex h-52 w-52 items-center justify-center overflow-hidden rounded-full">
          <img src={ReceipImg} alt="error card" className="max-w-52" />
        </div>
        <p className="text-muted-foreground text-sm">
          An Error Occurred... {JSON.stringify(loadingError) || ""}
        </p>
      </div>
    );
  }

  if (!offer) {
    return <div>Loading...</div>;
  }

  const onDeleteOffer = async (id: string) => {
    setLoading(true);
    try {
      await deleteLoanOffer(id);
      setIsDialogOpen(false);
      navigate("/my-offers");
    } catch (error) {
      setError(`${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: EditFormData) => {
    if (!id) return;

    setIsSubmitting(true);
    try {
      const updateData: UpdateLoanOfferRequest = {
        min_ltv: data.min_ltv ? data.min_ltv / 100 : undefined,
        interest_rate: data.interest_rate
          ? data.interest_rate / 100
          : undefined,
        loan_amount_min: data.loan_amount_min,
        loan_amount_max: data.loan_amount_max,
        loan_amount_reserve: data.loan_amount_reserve,
        duration_days_min: data.duration_days_min,
        duration_days_max: data.duration_days_max,
        auto_accept: data.auto_accept,
        loan_repayment_address: data.loan_repayment_address,
        btc_loan_repayment_address:
          data.btc_loan_repayment_address || undefined,
        extension_duration_days: data.extension_duration_days,
        extension_interest_rate: data.extension_interest_rate
          ? data.extension_interest_rate / 100
          : undefined,
        kyc_link: data.kyc_link || undefined,
      };

      await updateLoanOffer(id, updateData);
      setIsEditing(false);
      toast.success("Loan offer updated successfully");

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      toast.error("Error updating loan offer", {
        description: "Please check your inputs and try again.",
      });
      setError(`${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loanAsset = offer.loan_asset;
  const coinLabel = LoanAssetHelper.print(loanAsset);
  const loanTypeLabel = repaymentPlanLabel(offer.repayment_plan);

  const handleEdit = () => {
    setIsEditing(true);
    setError("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    form.reset();
    setError("");
  };

  return (
    <ScrollArea className="h-screen">
      <div className="mx-auto space-y-6 p-6 pb-20">
        {/* Header with Edit/Save buttons */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Loan Offer Details</h1>
              {offer.status === LoanOfferStatus.Deleted && (
                <Badge variant="destructive" className="font-semibold">
                  Deleted
                </Badge>
              )}
              {offer.status === LoanOfferStatus.Unavailable && (
                <Badge variant="secondary" className="font-semibold">
                  Unavailable
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {isEditing
                ? "Edit your loan offer terms"
                : offer.status === LoanOfferStatus.Deleted
                  ? "This loan offer has been deleted and is no longer available"
                  : offer.status === LoanOfferStatus.Unavailable
                    ? "This loan offer is temporarily unavailable"
                    : "View and manage your loan offer"}
            </p>
          </div>

          {!isEditing &&
            offer.status !== LoanOfferStatus.Deleted &&
            offer.status !== LoanOfferStatus.Unavailable && (
              <Button
                onClick={handleEdit}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit Offer
              </Button>
            )}

          {isEditing && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={form.handleSubmit(handleSubmit)}
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {(offer.status === LoanOfferStatus.Deleted ||
          offer.status === LoanOfferStatus.Unavailable) && (
          <Alert
            variant={
              offer.status === LoanOfferStatus.Deleted
                ? "destructive"
                : "default"
            }
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {offer.status === LoanOfferStatus.Deleted
                ? "Offer Deleted"
                : "Offer Unavailable"}
            </AlertTitle>
            <AlertDescription>
              {offer.status === LoanOfferStatus.Deleted
                ? "This loan offer has been permanently deleted. It cannot be edited or reactivated. Borrowers can no longer view or accept this offer."
                : "This loan offer is temporarily unavailable. It may have reached its reserve limit or been temporarily disabled. Contact support if you believe this is an error."}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form className="space-y-6">
            {/* Basic Information - Read Only */}
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
                  <div>
                    <FormLabel>Loan Asset</FormLabel>
                    <div className="mt-1">
                      <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                        {coinLabel}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        <LoanAssetDescription asset={loanAsset} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <FormLabel>Repayment Plan</FormLabel>
                    <div className="mt-1">
                      <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                        {loanTypeLabel}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {offer.repayment_plan === "bullet" &&
                          "Full principal and interest paid at the end of the loan term in a single payment."}
                        {offer.repayment_plan === "interest_only_monthly" &&
                          "Monthly interest payments throughout the loan term, with principal paid at maturity."}
                      </div>
                    </div>
                  </div>
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
                          {isEditing ? (
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="e.g., 1000"
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
                          ) : (
                            <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                              {formatCurrency(
                                offer.loan_amount_min,
                                LoanAssetHelper.toCurrency(offer.loan_asset),
                              )}
                            </div>
                          )}
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
                          {isEditing ? (
                            <Input
                              type="text"
                              placeholder="e.g., 100000"
                              inputMode="numeric"
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "" || /^\d*$/.test(value)) {
                                  console.log(`New value ${value}`);
                                  const newValue =
                                    value === "" ? 0 : parseInt(value);
                                  field.onChange(newValue);

                                  // Auto-update reserve amount if it's less than max loan amount
                                  const currentReserve = form.getValues(
                                    "loan_amount_reserve",
                                  );
                                  if (
                                    newValue &&
                                    currentReserve &&
                                    currentReserve < newValue
                                  ) {
                                    form.setValue(
                                      "loan_amount_reserve",
                                      newValue,
                                    );
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                              {formatCurrency(
                                offer.loan_amount_max,
                                LoanAssetHelper.toCurrency(offer.loan_asset),
                              )}
                            </div>
                          )}
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
                        {isEditing ? (
                          <Input
                            type="text"
                            placeholder="e.g., 100000"
                            inputMode="numeric"
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
                        ) : (
                          <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                            {formatCurrency(
                              offer.loan_amount_reserve,
                              LoanAssetHelper.toCurrency(offer.loan_asset),
                            )}
                            <span className="text-muted-foreground ml-2 text-xs">
                              (
                              {formatCurrency(
                                offer.loan_amount_reserve_remaining,
                                LoanAssetHelper.toCurrency(offer.loan_asset),
                              )}{" "}
                              remaining)
                            </span>
                          </div>
                        )}
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
                          {isEditing ? (
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="e.g., 12.5"
                              defaultValue={field.value?.toString() || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string
                                if (value === "") {
                                  field.onChange(undefined);
                                  return;
                                }

                                // Allow valid decimal number patterns including trailing decimal
                                if (/^\d*\.?\d*$/.test(value)) {
                                  // Don't parse if it ends with a decimal point - just store the string temporarily
                                  if (value.endsWith(".")) {
                                    // Don't update the field yet, just allow typing
                                    return;
                                  }

                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue)) {
                                    field.onChange(numValue);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                // On blur, clean up any trailing decimal points
                                const value = e.target.value;
                                if (value !== "") {
                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue)) {
                                    field.onChange(numValue);
                                    e.target.value = numValue.toString();
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                              {(offer.interest_rate * 100).toFixed(2)}%
                            </div>
                          )}
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
                          {isEditing ? (
                            <Input
                              type="text"
                              placeholder="e.g., 70"
                              inputMode="decimal"
                              defaultValue={field.value?.toString() || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string
                                if (value === "") {
                                  field.onChange(undefined);
                                  return;
                                }

                                // Allow valid decimal number patterns including trailing decimal
                                if (/^\d*\.?\d*$/.test(value)) {
                                  // Don't parse if it ends with a decimal point - just store the string temporarily
                                  if (value.endsWith(".")) {
                                    // Don't update the field yet, just allow typing
                                    return;
                                  }

                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue) && numValue <= 100) {
                                    field.onChange(numValue);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                // On blur, clean up any trailing decimal points
                                const value = e.target.value;
                                if (value !== "") {
                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue) && numValue <= 100) {
                                    field.onChange(numValue);
                                    e.target.value = numValue.toString();
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                              {(offer.min_ltv * 100).toFixed(2)}%
                            </div>
                          )}
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
                          {isEditing ? (
                            <Input
                              type="text"
                              placeholder="e.g., 7"
                              inputMode="numeric"
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
                          ) : (
                            <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                              {offer.duration_days_min} days
                            </div>
                          )}
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
                          {isEditing ? (
                            <Input
                              type="text"
                              placeholder="e.g., 360"
                              inputMode="numeric"
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
                          ) : (
                            <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                              {offer.duration_days_max} days
                            </div>
                          )}
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

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="extension_duration_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Extension Duration (Days)</FormLabel>
                          <FormControl>
                            {isEditing ? (
                              <Input
                                type="text"
                                placeholder="Optional"
                                inputMode="numeric"
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
                            ) : (
                              <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                                {offer.extension_max_duration_days > 0
                                  ? `${offer.extension_max_duration_days} days`
                                  : "Disabled"}
                              </div>
                            )}
                          </FormControl>
                          <FormDescription>
                            If set, the borrower can extend the loan for{" "}
                            {field.value ? field.value : "n"} days.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(isEditing ||
                      (offer.extension_interest_rate &&
                        offer.extension_interest_rate > 0)) && (
                      <FormField
                        control={form.control}
                        name="extension_interest_rate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Extension Interest Rate (%)</FormLabel>
                            <FormControl>
                              {isEditing ? (
                                <Input
                                  type="text"
                                  placeholder="e.g., 20"
                                  inputMode="decimal"
                                  defaultValue={field.value?.toString() || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    // Allow empty string
                                    if (value === "") {
                                      field.onChange(undefined);
                                      return;
                                    }

                                    // Allow valid decimal number patterns including trailing decimal
                                    if (/^\d*\.?\d*$/.test(value)) {
                                      // Don't parse if it ends with a decimal point - just store the string temporarily
                                      if (value.endsWith(".")) {
                                        // Don't update the field yet, just allow typing
                                        return;
                                      }

                                      const numValue = parseFloat(value);
                                      if (!isNaN(numValue)) {
                                        field.onChange(numValue);
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // On blur, clean up any trailing decimal points
                                    const value = e.target.value;
                                    if (value !== "") {
                                      const numValue = parseFloat(value);
                                      if (!isNaN(numValue)) {
                                        field.onChange(numValue);
                                        e.target.value = numValue.toString();
                                      }
                                    }
                                  }}
                                />
                              ) : (
                                <div className="bg-muted rounded-lg border px-3 py-2 text-sm">
                                  {offer.extension_interest_rate
                                    ? (
                                        offer.extension_interest_rate * 100
                                      ).toFixed(2)
                                    : "20.00"}
                                  %
                                </div>
                              )}
                            </FormControl>
                            <FormDescription>
                              Interest rate for loan extensions.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
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
                        {isEditing ? (
                          <LoanAddressInputField
                            loanAddress={field.value || ""}
                            setLoanAddress={field.onChange}
                            loanAsset={loanAsset}
                            renderWarning={true}
                            placeholder="Enter repayment wallet address"
                          />
                        ) : (
                          <div className="bg-muted break-all rounded-lg border px-3 py-2 text-sm">
                            {offer.loan_repayment_address}
                          </div>
                        )}
                      </FormControl>
                      <FormDescription>
                        Address where loan repayments will be sent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(isEditing && offer.btc_loan_repayment_address) ||
                (!isEditing && offer.btc_loan_repayment_address) ? (
                  <FormField
                    control={form.control}
                    name="btc_loan_repayment_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          BTC Repayment Address
                          <Badge variant="secondary">Optional</Badge>
                        </FormLabel>
                        <FormControl>
                          {isEditing ? (
                            <Input
                              placeholder="Enter BTC repayment address (optional)"
                              {...field}
                            />
                          ) : (
                            <div className="bg-muted break-all rounded-lg border px-3 py-2 text-sm">
                              {offer.btc_loan_repayment_address || "Not set"}
                            </div>
                          )}
                        </FormControl>
                        <FormDescription>
                          Optional BTC address for repayments
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

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
                          {isEditing ? (
                            <Input
                              type="url"
                              placeholder="https://example.com/kyc"
                              {...field}
                            />
                          ) : (
                            <div className="bg-muted break-all rounded-lg border px-3 py-2 text-sm">
                              {offer.kyc_link || "Not set"}
                            </div>
                          )}
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
                            onCheckedChange={
                              isEditing ? field.onChange : undefined
                            }
                            disabled={!isEditing}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Dates and Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm font-medium">
                        Created on:
                      </span>
                      <span className="text-sm font-medium">
                        {new Date(offer.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm font-medium">
                        Last Edited:
                      </span>
                      <span className="text-sm font-medium">
                        {new Date(offer.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Retract Offer Button */}
                  {!isEditing &&
                    offer.status !== LoanOfferStatus.Deleted &&
                    offer.status !== LoanOfferStatus.Unavailable && (
                      <Dialog
                        open={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button variant="destructive">Retract Offer</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Retract Offer</DialogTitle>
                            <DialogDescription>
                              Please confirm the retraction of this offer.
                            </DialogDescription>
                          </DialogHeader>

                          {error && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Error</AlertTitle>
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          )}

                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setIsDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => onDeleteOffer(offer.id)}
                              disabled={loading}
                            >
                              {loading ? (
                                <>
                                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                                  Retracting...
                                </>
                              ) : (
                                "Retract"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </ScrollArea>
  );
}

export default MyLoanOfferDetails;
