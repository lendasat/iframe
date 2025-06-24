import { useWallet } from "@frontend/browser-wallet";
import {
  CreateLoanOfferRequest,
  LenderFeatureFlags,
  RepaymentPlan,
  useAuth,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAddressInputField,
  LoanAsset,
  LoanAssetHelper,
  LoanPayout,
  ONE_YEAR,
  parseLoanAsset,
} from "@frontend/ui-shared";
import { useCallback, useState, useEffect } from "react";
import { MdOutlineSwapCalls } from "react-icons/md";
import { FaInfoCircle } from "react-icons/fa";
import { PiInfo, PiWarningCircle } from "react-icons/pi";
import { useNavigate } from "react-router-dom";
import { KycLinkInputField } from "./components/KycLinkInputField";
import DurationSelector from "./LoanDurationSelector";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loanOfferSchema,
  LoanOfferFormValues,
  defaultLoanOfferValues,
} from "./loanOfferSchema";
import { Button, ToggleGroup, ToggleGroupItem } from "@frontend/shadcn";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Separator } from "@frontend/shadcn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import { Checkbox } from "@frontend/shadcn";
import { Card } from "@frontend/shadcn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@frontend/shadcn";
import { ScrollArea } from "@frontend/shadcn";
import { LuLoader } from "react-icons/lu";

type FormValues = LoanOfferFormValues;

const CreateLoanOffer = () => {
  const { getNpub, getPkAndDerivationPath } = useWallet();
  const { enabledFeatures } = useAuth();
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);

  const navigate = useNavigate();
  const { postLoanOffer } = useLenderHttpClient();

  const autoApproveEnabled = enabledFeatures.includes(
    LenderFeatureFlags.AutoApproveLoanRequests,
  );
  const kycOffersEnabled = enabledFeatures.includes(
    LenderFeatureFlags.KycOffers,
  );

  const [repaymentPlan, setRepaymentPlan] = useState("bullet");

  const handleHideWalletConnectButton = useCallback((value: boolean) => {
    setHideWalletConnectButton(value);
  }, []);

  // Initialize the form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(loanOfferSchema),
    defaultValues: {
      ...defaultLoanOfferValues,
      autoAccept: autoApproveEnabled,
    },
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStableCoinChange = useCallback(
    (coinString: string) => {
      const coin = parseLoanAsset(coinString);
      form.setValue("loanAsset", coin);
      form.setValue("loanRepaymentAddress", "");
      setHideWalletConnectButton(false);
    },
    [form],
  );

  const handleRangeChange = (start: number, end: number) => {
    form.setValue("loanDuration", { min: start, max: end });
  };

  const mapToCreateLoanOfferSchema = (
    lender_npub: string,
    lender_pk: string,
    lender_derivation_path: string,
  ): CreateLoanOfferRequest => {
    const values = form.getValues();

    console.log(`Auto approve is ${values.autoAccept}`);

    const extension_duration_days = values.extension_enabled
      ? values.extension_duration_days
      : 0;
    const extension_interest_rate = values.extension_enabled
      ? values.extension_interest_rate / 100
      : 0;

    // We are not allowing weekly interest-only loans for now.
    let repayment_plan: RepaymentPlan;
    if (repaymentPlan === "interest-only") {
      repayment_plan = RepaymentPlan.InterestOnlyMonthly;
    } else {
      repayment_plan = RepaymentPlan.Bullet;
    }

    return {
      name: "Loan Offer",
      min_ltv: values.ltv / 100,
      interest_rate: values.interest / 100,
      loan_amount_min: values.loanAmount.min,
      loan_amount_max: values.loanAmount.max,
      loan_amount_reserve: values.loanReserve,
      duration_days_min: values.loanDuration.min,
      duration_days_max: values.loanDuration.max,
      loan_asset: values.loanAsset as LoanAsset,
      // We choose to only allow direct payout offers through the Lendasat UI.
      loan_payout: LoanPayout.Direct,
      loan_repayment_address: values.loanRepaymentAddress || "",
      auto_accept: values.autoAccept,
      lender_npub,
      lender_pk,
      lender_derivation_path,
      kyc_link: values.isKycRequired ? values.kycLink || undefined : undefined,
      extension_duration_days,
      extension_interest_rate,
      repayment_plan: repayment_plan,
    };
  };

  const onSubmit = async (data: FormValues) => {
    console.log(`Submitting ${JSON.stringify(data)}`);

    if (data.loanReserve < data.loanAmount.max) {
      setError("Loan reserve cannot be smaller than max loan amount.");
      return;
    }

    setError("");

    try {
      const lender_npub = await getNpub();
      const lender_pk = await getPkAndDerivationPath();
      const requestData = mapToCreateLoanOfferSchema(
        lender_npub,
        lender_pk.pubkey,
        lender_pk.path,
      );

      setLoading(true);
      const res = await postLoanOffer(requestData);
      if (res !== undefined) {
        navigate(`/my-offers/${res.id}`);
      } else {
        console.error(res);
        setError(`Could not create loan offer`);
      }
    } catch (e) {
      console.error(e);
      setError(`Failed to create offer: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const watchLoanAsset = form.watch("loanAsset");
  const watchLoanAmount = form.watch("loanAmount");
  const watchLoanDuration = form.watch("loanDuration");
  const watchLtv = form.watch("ltv");
  const watchInterest = form.watch("interest");
  const watchIsKycRequired = form.watch("isKycRequired");
  const watchLoanRepaymentAddress = form.watch("loanRepaymentAddress");

  // Sync extension_interest_rate with interest
  useEffect(() => {
    form.setValue("extension_interest_rate", watchInterest);
  }, [watchInterest, form]);

  const isRepaymentAddressRequired = LoanAssetHelper.isStableCoin(
    watchLoanAsset as LoanAsset,
  );

  const disableCreateOfferButton =
    watchLoanAmount.max === 0 ||
    watchLoanDuration.max === 0 ||
    watchLtv === 0 ||
    loading ||
    (watchIsKycRequired &&
      (!form.watch("kycLink") || form.watch("kycLink")?.length === 0)) ||
    (isRepaymentAddressRequired &&
      (!watchLoanRepaymentAddress || watchLoanRepaymentAddress.length === 0));

  return (
    <div className="flex w-full">
      <ScrollArea className="max-h-[90vh] overflow-y-auto">
        <div className="grid w-full grid-cols-1 lg:grid-cols-7 xl:grid-cols-6">
          <div className="border-border/10 from-background/0 to-background border-r bg-gradient-to-br py-7 md:col-span-4 lg:pb-14">
            <div className="px-6 md:px-8">
              <Card className="border-border/10 px-6 py-10 md:px-8">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    {/* Amount */}
                    <FormField
                      control={form.control}
                      name="loanAmount"
                      render={() => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-muted-foreground">
                            Amount to Lend
                          </FormLabel>
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              placeholder="Min Amount"
                              value={
                                form.watch("loanAmount.min") === 0
                                  ? ""
                                  : form.watch("loanAmount.min")
                              }
                              onChange={(e) => {
                                const value =
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value);
                                if (!Number.isNaN(value)) {
                                  form.setValue("loanAmount.min", value);
                                }
                              }}
                              className="flex-1"
                            />
                            <MdOutlineSwapCalls className="text-muted-foreground" />
                            <Input
                              type="number"
                              placeholder="Max Amount"
                              value={
                                form.watch("loanAmount.max") === 0
                                  ? ""
                                  : form.watch("loanAmount.max")
                              }
                              onChange={(e) => {
                                const value =
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value);
                                if (!Number.isNaN(value)) {
                                  form.setValue("loanAmount.max", value);
                                }
                              }}
                              className="flex-1"
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Reserve */}
                    <FormField
                      control={form.control}
                      name="loanReserve"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-muted-foreground">
                            Reserve (max amount across all requests for this
                            offer)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Loan Reserve"
                              value={field.value === 0 ? "" : field.value}
                              onChange={(e) => {
                                const value =
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value);
                                if (!Number.isNaN(value)) {
                                  field.onChange(value);
                                  form.setValue("autoAccept", true);
                                }
                              }}
                              min={form.watch("loanAmount.max")}
                              disabled={!autoApproveEnabled}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Auto Accept */}
                    <FormField
                      control={form.control}
                      name="autoAccept"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={
                                    !autoApproveEnabled &&
                                    !form.watch("isKycRequired")
                                  }
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Auto Accept (Requests within the "Reserve" will
                                be automatically accepted)
                              </FormLabel>
                            </div>
                          </div>
                          {!autoApproveEnabled && (
                            <Alert variant="warning">
                              <PiInfo className="h-4 w-4" />
                              <AlertDescription>
                                You do not qualify for the auto approval feature
                                yet. Please reach out to us via discord if you
                                want it.
                              </AlertDescription>
                            </Alert>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Duration */}
                    <FormField
                      control={form.control}
                      name="loanDuration"
                      render={() => (
                        <FormItem className="space-y-1">
                          <div className="flex items-center gap-1">
                            <FormLabel className="text-muted-foreground">
                              Duration
                            </FormLabel>
                            <span className="text-muted-foreground/50 text-xs font-medium">
                              (Days)
                            </span>
                          </div>
                          <FormControl>
                            <DurationSelector
                              onRangeChange={handleRangeChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* LTV */}
                    <FormField
                      control={form.control}
                      name="ltv"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <FormLabel className="text-muted-foreground">
                                    Loan to value (LTV)
                                  </FormLabel>
                                  <FaInfoCircle className="text-muted-foreground h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="w-80">
                                <p>
                                  The loan-to-value (LTV) ratio is a financial
                                  term used to express the ratio of a loan to
                                  the value of an asset purchased.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex items-center gap-4">
                            <FormControl className="flex-1">
                              <Input
                                type="number"
                                placeholder="LTV (1-70%)"
                                min={1}
                                max={70}
                                step={1}
                                value={field.value === 0 ? "" : field.value}
                                onChange={(e) => {
                                  const value =
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value);
                                  if (!Number.isNaN(value)) {
                                    field.onChange(value);
                                  }
                                }}
                              />
                            </FormControl>
                            <span className="text-sm font-medium">
                              1% - 70%
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem className="space-y-1">
                      <FormLabel className="text-muted-foreground">
                        Loan Type
                      </FormLabel>
                      <ToggleGroup
                        type="single"
                        value={repaymentPlan}
                        onValueChange={(v) => v && setRepaymentPlan(v)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ToggleGroupItem
                              value="bullet"
                              aria-label="Bullet loan"
                              className={
                                repaymentPlan === "bullet"
                                  ? "bg-primary border-primary hover:bg-primary hover:border-primary text-white hover:text-white"
                                  : "border-gray-300 bg-white text-black hover:border-gray-400 hover:bg-gray-100"
                              }
                            >
                              Bullet
                            </ToggleGroupItem>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Bullet loans are repaid in full at the end of the
                              loan term.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ToggleGroupItem
                              value="interest-only"
                              aria-label="Monthly interest loan"
                              className={
                                repaymentPlan === "interest-only"
                                  ? "bg-primary border-primary hover:bg-primary hover:border-primary text-white hover:text-white"
                                  : "border-gray-300 bg-white text-black hover:border-gray-400 hover:bg-gray-100"
                              }
                            >
                              <span className="block w-full min-w-[135px] whitespace-normal leading-tight">
                                Monthly interest
                              </span>
                            </ToggleGroupItem>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Monthly interest loans consist of <em>monthly</em>{" "}
                              interest installments, plus a balloon payment at
                              the end of the loan term.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </ToggleGroup>
                    </FormItem>

                    {/* Interest Rate */}
                    <FormField
                      control={form.control}
                      name="interest"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <FormLabel className="text-muted-foreground">
                                    Interest Rate
                                  </FormLabel>
                                  <FaInfoCircle className="text-muted-foreground h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="w-80">
                                <p>
                                  The interest rate is the amount a lender
                                  charges a borrower for the use of assets,
                                  expressed as a percentage of the principal.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex items-center gap-4">
                            <FormControl className="flex-1">
                              <Input
                                type="number"
                                placeholder="Interest Rate"
                                min={0}
                                max={100}
                                step={0.5}
                                value={field.value === 0 ? "" : field.value}
                                onChange={(e) => {
                                  const value =
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value);
                                  if (!Number.isNaN(value)) {
                                    field.onChange(value);
                                  }
                                }}
                              />
                            </FormControl>
                            <span className="text-sm font-medium">
                              0% - 100%
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Extension Settings */}
                    <FormField
                      control={form.control}
                      name="extension_enabled"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2">
                                    <FormLabel className="text-muted-foreground">
                                      Enable Loan Extension
                                    </FormLabel>
                                    <FaInfoCircle className="text-muted-foreground h-4 w-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="w-80">
                                  <p>
                                    If you want to enable loan extensions you
                                    can either define it here or after a loan
                                    has been established.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Extension Duration - Only shown if extension is enabled */}
                    <FormField
                      control={form.control}
                      name="extension_duration_days"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <FormLabel className="text-muted-foreground">
                                    Max allowed extension duration (Days)
                                  </FormLabel>
                                  <FaInfoCircle className="text-muted-foreground h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="w-80">
                                <p>
                                  The maximum number of days a borrower can
                                  extend the loan for.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex items-center gap-4">
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Extension Duration (Days)"
                                min={1}
                                max={ONE_YEAR}
                                value={field.value === 0 ? "" : field.value}
                                disabled={!form.watch("extension_enabled")}
                                onChange={(e) => {
                                  const value =
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value);
                                  if (!Number.isNaN(value)) {
                                    field.onChange(value);
                                  }
                                }}
                              />
                            </FormControl>
                            <span className="text-sm font-medium">
                              7 - {ONE_YEAR}
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="extension_interest_rate"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <FormLabel className="text-muted-foreground">
                                    Extension Interest Rate
                                  </FormLabel>
                                  <FaInfoCircle className="text-muted-foreground h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="w-80">
                                <p>
                                  The interest rate that will be applied during
                                  the extension period. This can be the same or
                                  different from the initial interest rate.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex items-center gap-4">
                            <FormControl className="flex-1">
                              <Input
                                type="number"
                                placeholder="Extension Interest Rate"
                                min={0}
                                max={100}
                                step={0.5}
                                disabled={!form.watch("extension_enabled")}
                                value={field.value === 0 ? "" : field.value}
                                onChange={(e) => {
                                  const value =
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value);
                                  if (!Number.isNaN(value)) {
                                    field.onChange(value);
                                  }
                                }}
                              />
                            </FormControl>
                            <span className="text-sm font-medium">
                              0% - 100%
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Asset to Lend */}
                    <FormItem className="space-y-1">
                      <FormLabel className="text-muted-foreground">
                        What asset will you lend?
                      </FormLabel>
                      <Tabs defaultValue="stablecoins" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="stablecoins">
                            Stablecoins
                          </TabsTrigger>
                          <TabsTrigger value="fiat">Fiat</TabsTrigger>
                        </TabsList>
                        <TabsContent value="stablecoins" className="pt-3">
                          <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                              {LoanAssetHelper.allStableCoins().map((asset) => (
                                <Button
                                  key={asset}
                                  variant={
                                    watchLoanAsset === asset
                                      ? "default"
                                      : "outline"
                                  }
                                  type="button"
                                  className="h-10 rounded-lg"
                                  onClick={() => handleStableCoinChange(asset)}
                                >
                                  {LoanAssetHelper.print(asset)}
                                </Button>
                              ))}
                            </div>
                            {/* Repayment Address */}
                            <FormField
                              control={form.control}
                              name="loanRepaymentAddress"
                              render={() => (
                                <FormItem className="space-y-1">
                                  <FormLabel className="text-muted-foreground">
                                    Loan Repayment Address
                                  </FormLabel>
                                  <FormControl>
                                    <LoanAddressInputField
                                      loanAddress={
                                        form.watch("loanRepaymentAddress") || ""
                                      }
                                      setLoanAddress={(address) =>
                                        form.setValue(
                                          "loanRepaymentAddress",
                                          address,
                                        )
                                      }
                                      loanAsset={watchLoanAsset as LoanAsset}
                                      hideButton={hideWalletConnectButton}
                                      setHideButton={
                                        handleHideWalletConnectButton
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="fiat" className="pt-3">
                          <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                              {LoanAssetHelper.allFiatCoins().map((asset) => (
                                <Button
                                  key={asset}
                                  variant={
                                    watchLoanAsset === asset
                                      ? "default"
                                      : "outline"
                                  }
                                  type="button"
                                  className="h-10 rounded-lg"
                                  onClick={() => handleStableCoinChange(asset)}
                                >
                                  {LoanAssetHelper.print(asset)}
                                </Button>
                              ))}
                            </div>
                            <Alert>
                              <PiInfo className="h-4 w-4" />
                              <AlertDescription>
                                You will need to provide your banking details
                                when approving a request. These details will be
                                e2e encrypted and only shared with the
                                corresponding borrower.
                              </AlertDescription>
                            </Alert>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </FormItem>

                    {/* KYC Link Input Field */}
                    {kycOffersEnabled && (
                      <FormItem>
                        <FormControl>
                          <KycLinkInputField
                            link={form.watch("kycLink") || ""}
                            setLink={(link) => form.setValue("kycLink", link)}
                            isKycRequired={form.watch("isKycRequired")}
                            setIsKycRequired={(isRequired) => {
                              if (isRequired) {
                                // If KYC is required, we can't do autoaccept
                                form.setValue("autoAccept", false);
                              }
                              form.setValue("isKycRequired", isRequired);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}

                    {/* Error Message */}
                    {error && (
                      <Alert variant="destructive">
                        <PiWarningCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className={"w-full"}
                      disabled={disableCreateOfferButton}
                    >
                      {loading ? (
                        <>
                          <LuLoader className="animate-spin" />
                          Please wait
                        </>
                      ) : (
                        "Create Offer"
                      )}
                    </Button>
                  </form>
                </Form>
              </Card>
            </div>
          </div>

          {/* Summary Panel */}
          <div className="flex flex-col justify-center px-6 py-12 lg:col-span-3 xl:col-span-2">
            <p className="text-muted-foreground text-center text-sm font-medium">
              Offer Summary
            </p>
            <h2 className="text-center text-2xl font-bold">
              Borrowers will see
            </h2>

            <div className="my-10">
              <h3 className="text-muted-foreground/70 text-sm font-medium">
                Loan Parameters
              </h3>
              <Separator className="my-4 opacity-50" />

              <div className="my-4 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Amount</span>
                <span className="text-foreground/80 text-sm font-semibold">
                  {formatCurrency(watchLoanAmount.min)} -{" "}
                  {formatCurrency(watchLoanAmount.max)}
                </span>
              </div>
              <Separator className="opacity-50" />

              <div className="my-4 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Duration</span>
                <span className="text-foreground/80 text-sm font-semibold">
                  {getFormatedStringFromDays(watchLoanDuration.min)} -{" "}
                  {getFormatedStringFromDays(watchLoanDuration.max)}
                </span>
              </div>
              <Separator className="opacity-50" />

              <div className="my-4 flex items-center justify-between">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          LTV
                        </span>
                        <FaInfoCircle className="text-muted-foreground h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="w-80">
                      <p>
                        The loan-to-value (LTV) ratio is a financial term used
                        to express the ratio of a loan to the value of an asset
                        purchased.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-foreground/80 text-sm font-semibold">
                  {watchLtv.toFixed(2)}%
                </span>
              </div>
              <Separator className="opacity-50" />

              <div className="my-4 flex items-center justify-between">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          Interest Rate
                        </span>
                        <FaInfoCircle className="text-muted-foreground h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="w-80">
                      <p>
                        The interest rate is the amount a lender charges a
                        borrower for the use of assets, expressed as a
                        percentage of the principal.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-foreground/80 text-sm font-semibold">
                  {watchInterest.toFixed(2)}%
                </span>
              </div>
              <Separator className="opacity-50" />

              <div className="my-4 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Loan Asset
                </span>
                <span className="text-foreground/80 text-sm font-semibold">
                  {watchLoanAsset
                    ? LoanAssetHelper.print(watchLoanAsset as LoanAsset)
                    : ""}
                </span>
              </div>

              <Separator className="opacity-50" />

              <div className="my-4 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Loan Type</span>
                <span className="text-foreground/80 text-sm font-semibold">
                  {repaymentPlan === "bullet" ? "Bullet" : "Monthly Interest"}
                </span>
              </div>

              {kycOffersEnabled && (
                <>
                  <Separator className="opacity-50" />
                  <div className="my-4 flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      KYC Required
                    </span>
                    <span className="text-foreground/80 text-sm font-semibold">
                      {watchIsKycRequired ? "Yes" : "No"}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="my-4">
              <h3 className="text-muted-foreground/70 text-sm font-medium">
                Repayment
              </h3>
              <Separator className="my-4 opacity-50" />
              <div className="my-4 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Address</span>
                <span className="text-foreground/80 text-xs font-semibold capitalize">
                  {watchLoanRepaymentAddress
                    ? watchLoanRepaymentAddress.slice(0, 14) + "..."
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CreateLoanOffer;
