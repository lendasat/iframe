import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAsync } from "react-use";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Network, validate } from "bitcoin-address-validation";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardHeader,
  Form,
  Skeleton,
} from "@frontend/shadcn";
import { AlertTriangle, ArrowLeft, ChevronRight } from "lucide-react";
import {
  FiatLoanDetails,
  LoanOffer,
  LoanType,
  RepaymentPlan,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  formatCurrency,
  LenderStatsLabel,
  LoanAssetHelper,
  LoanPayout,
  ONE_MONTH,
  ONE_YEAR,
  usePriceForCurrency,
} from "@frontend/ui-shared";
import { toast } from "sonner";
import { useWallet } from "@frontend/browser-wallet";
import { LoanProductTypes } from "./loan-request-flow";
import { MobileStepWizard, StepWizard } from "./components/step-wizard";
import { LoanConfigurationStep } from "./components/loan-configuration-step";
import { PaymentSetupStep } from "./components/payment-setup-step";
import { ReviewConfirmStep } from "./components/review-confirm-step";
import axios from "axios";
import { add } from "date-fns";

const NEW_CARD_CONSTANT = "New";

async function isInUS(): Promise<boolean> {
  try {
    const response = await axios.get("https://get.geojs.io/v1/ip/country.json");
    const data = response.data;
    return data.country === "US";
  } catch (error) {
    console.error("Error fetching geo-location data:", error);
    return true;
  }
}

export interface LoanCalculation {
  principal: number;
  interest: number;
  total: number;
  originationFeeUsd: number;
  originationFeeBtc: number;
  collateralRequiredUsd: number;
  collateralRequiredBtc: number;
  apr: number;
  ltv: number;
  expiry: Date;
}

export interface LoanFormData {
  loanAmount: number;
  loanDuration: number;
  bitcoinAddress: string;
  stablecoinAddress?: string;
  moonCardId?: string;
  confirmLoanTerms: boolean;
}

// Validation functions
const validateBitcoinAddress = (address: string) => {
  let network = Network.mainnet;
  if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    network = Network.testnet;
  } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
    network = Network.regtest;
  }

  return validate(address, network);
};

// Base form schema with all possible fields
const createLoanFormSchema = (
  needsStablecoinAddress: boolean,
  paymentType: LoanProductTypes,
  offer?: LoanOffer | null,
) => {
  return z.object({
    loanAmount: z
      .number()
      .min(
        offer?.loan_amount_min || 1,
        `Amount must be at least ${formatCurrency(offer?.loan_amount_min || 1, LoanAssetHelper.toCurrency(offer?.loan_asset))}`,
      )
      .max(
        offer?.loan_amount_max || Number.MAX_SAFE_INTEGER,
        `Amount cannot exceed ${formatCurrency(offer?.loan_amount_max || Number.MAX_SAFE_INTEGER, LoanAssetHelper.toCurrency(offer?.loan_asset))}`,
      )
      .refine((val) => !Number.isNaN(val), "Must be a valid number"),
    loanDuration: z
      .number()
      .min(
        offer?.duration_days_min || 1,
        `Duration must be at least ${offer?.duration_days_min || 1} days`,
      )
      .max(
        offer?.duration_days_max || Number.MAX_SAFE_INTEGER,
        `Duration cannot exceed ${offer?.duration_days_max || Number.MAX_SAFE_INTEGER} days`,
      )
      .refine((val) => !Number.isNaN(val), "Must be a valid number"),
    bitcoinAddress: z
      .string()
      .min(1, "Bitcoin address is required")
      .refine(
        (data) => validateBitcoinAddress(data),
        "Invalid Bitcoin address",
      ),
    stablecoinAddress: needsStablecoinAddress
      ? z.string().min(1, "Receiving address is required")
      : z.string().optional(),
    moonCardId:
      paymentType === LoanProductTypes.PayWithMoon
        ? z
            .string({
              required_error: "Please select either a new or an existing card.",
            })
            .refine(
              (data) => data.trim().length > 0,
              "Please select either a new or an existing card.",
            )
        : z.string().optional(),
    confirmLoanTerms: z
      .boolean()
      .refine((val) => val, "You must accept the loan terms to continue"),
  });
};

const calculateLoan = (
  latestPrice: number | undefined,
  amount: number,
  durationDays: number,
  offer?: LoanOffer | null,
): LoanCalculation => {
  if (!offer || !latestPrice || latestPrice === 0) {
    return {
      principal: 0,
      interest: 0,
      total: 0,
      originationFeeUsd: 0,
      originationFeeBtc: 0,
      collateralRequiredBtc: 0,
      collateralRequiredUsd: 0,
      apr: 0,
      ltv: 0,
      expiry: new Date(),
    };
  }

  const principal = amount;
  const rate = offer.interest_rate;
  const ratePerDuration = (rate / ONE_YEAR) * durationDays;
  const interest = principal * ratePerDuration;

  // TODO: pick correct fee if we have multiple
  const originationFeeRate = offer.origination_fee?.[0]?.fee || 0.015;
  const originationFeeUsd = principal * originationFeeRate;
  const originationFeeBtc = originationFeeUsd / latestPrice;

  const total = principal + interest;
  const ltv = offer.min_ltv;

  const collateralRequiredBtc =
    (principal + interest) / ltv / latestPrice + originationFeeBtc;
  const collateralRequiredUsd = collateralRequiredBtc * latestPrice;

  const apr = rate * 100;

  const expiry = add(new Date(), { days: durationDays });

  return {
    principal,
    interest,
    total,
    originationFeeUsd: originationFeeUsd,
    originationFeeBtc: originationFeeBtc,
    collateralRequiredBtc,
    collateralRequiredUsd,
    apr,
    ltv: ltv * 100,
    expiry,
  };
};

export const LoanOfferDetails = () => {
  const navigate = useNavigate();
  const { offerId, step } = useParams<{ offerId: string; step?: string }>();
  const [searchParams] = useSearchParams();

  // Get current step from URL params, default to 'configure'
  const currentStepParam = step || "configure";
  const stepMap = {
    configure: 0,
    payment: 1,
    review: 2,
  } as const;

  const currentStep = stepMap[currentStepParam as keyof typeof stepMap] ?? 0;

  // Redirect to configure step if no step is specified
  useEffect(() => {
    if (!step && offerId) {
      const queryString = searchParams.toString();
      navigate(
        `/loan-offers/${offerId}/configure${queryString ? `?${queryString}` : ""}`,
        { replace: true },
      );
    }
  }, [step, offerId, searchParams, navigate]);
  const {
    getLoanOffer,
    postContractRequest,
    getUserCards,
    hasBringinApiKey: getHasBringinApiKey,
  } = useHttpClientBorrower();
  const { getNpub, getPkAndDerivationPath, encryptFiatLoanDetailsBorrower } =
    useWallet();

  const { loading: apiKeyLoading, value: maybeApiKey } = useAsync(async () => {
    return await getHasBringinApiKey();
  });

  const hasBriningApiKey = !apiKeyLoading && maybeApiKey;

  // Fetch the actual loan offer
  const {
    loading,
    value: offer,
    error,
  } = useAsync(async () => {
    if (!offerId) return null;
    return getLoanOffer(offerId);
  }, [offerId]);

  // Get payment type from query params
  const paymentType =
    (searchParams.get("paymentType") as LoanProductTypes) ||
    LoanProductTypes.Any;

  // Parse and validate query parameters
  const getInitialAmount = useCallback(() => {
    const queryAmount = searchParams.get("amount");
    if (queryAmount && offer) {
      if (
        queryAmount.trim().length === 0 ||
        Number.isNaN(Number(queryAmount))
      ) {
        return offer?.loan_amount_min;
      } else {
        return Number(queryAmount);
      }
    }
    return offer?.loan_amount_min || 1000;
  }, [searchParams, offer]);

  const getInitialDuration = useCallback(() => {
    const queryDuration = searchParams.get("duration");
    if (queryDuration && offer) {
      if (
        queryDuration.trim().length === 0 ||
        Number.isNaN(Number(queryDuration))
      ) {
        return offer?.duration_days_min;
      } else {
        return Number(queryDuration);
      }
    }
    return offer?.duration_days_min || 180;
  }, [searchParams, offer]);

  const getInitialBitcoinAddress = useCallback(() => {
    return searchParams.get("bitcoinAddress") || "";
  }, [searchParams]);

  const getInitialStablecoinAddress = useCallback(() => {
    return searchParams.get("stablecoinAddress") || "";
  }, [searchParams]);

  const getInitialMoonCardId = useCallback(() => {
    return searchParams.get("moonCardId") || "";
  }, [searchParams]);

  // State for additional fields

  const [fiatTransferDetailsConfirmed, setFiatTransferDetailsConfirmed] =
    useState(false);
  const [encryptedFiatTransferDetails, setEncryptedFiatTransferDetails] =
    useState<FiatLoanDetails>();
  const [isKycChecked, setIsKycChecked] = useState(false);
  const [kycFormDialogConfirmed, setKycFormDialogConfirmed] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [ownPk, setOwnPk] = useState<string | undefined>(undefined);
  const [ownPath, setOwnPath] = useState<string | undefined>();

  // Define the steps
  const steps = [
    {
      id: "configure",
      title: "Configure Loan",
      description: "Set amount and duration",
      isComplete: currentStep > 0,
      isActive: currentStep === 0,
    },
    {
      id: "payment",
      title: "Payment Setup",
      description: "Addresses and details",
      isComplete: currentStep > 1,
      isActive: currentStep === 1,
    },
    {
      id: "review",
      title: "Review & Confirm",
      description: "Final approval",
      isComplete: currentStep > 2,
      isActive: currentStep === 2,
    },
  ];

  // Determine what fields are needed based on loan type
  const needsStablecoinAddress =
    offer &&
    offer.loan_payout === LoanPayout.Direct &&
    LoanAssetHelper.isStableCoin(offer.loan_asset) &&
    paymentType !== LoanProductTypes.PayWithMoon &&
    paymentType !== LoanProductTypes.Bringin;

  const bringinButNoKey =
    paymentType === LoanProductTypes.Bringin && !hasBriningApiKey;

  const needsBanking = offer && LoanAssetHelper.isFiat(offer.loan_asset);
  const needsKyc = offer && (offer.kyc_link || "").trim().length > 0;

  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(offer?.loan_asset),
  );

  // Create schema based on current requirements
  const loanFormSchema = useMemo(
    () =>
      createLoanFormSchema(needsStablecoinAddress === true, paymentType, offer),
    [needsStablecoinAddress, paymentType, offer],
  );

  // Setup form with proper typing
  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      loanAmount: getInitialAmount(),
      loanDuration: getInitialDuration(),
      bitcoinAddress: getInitialBitcoinAddress(),
      stablecoinAddress: getInitialStablecoinAddress(),
      moonCardId: getInitialMoonCardId(),
      confirmLoanTerms: false,
    },
  });

  // Update form values when offer loads or URL params change
  useEffect(() => {
    if (offer) {
      form.setValue("loanAmount", getInitialAmount());
      form.setValue("loanDuration", getInitialDuration());
      form.setValue("bitcoinAddress", getInitialBitcoinAddress());
      form.setValue("stablecoinAddress", getInitialStablecoinAddress());
      form.setValue("moonCardId", getInitialMoonCardId());
    }
  }, [
    offer,
    getInitialAmount,
    getInitialDuration,
    getInitialBitcoinAddress,
    getInitialStablecoinAddress,
    getInitialMoonCardId,
    form,
  ]);

  const watchedValues = useWatch({
    control: form.control,
    name: ["loanAmount", "loanDuration", "confirmLoanTerms"],
  });

  const [watchLoanAmount, watchLoanDuration, confirmLoanTerms] = watchedValues;

  const calculation = useMemo(() => {
    return calculateLoan(
      latestPrice,
      watchLoanAmount || getInitialAmount(),
      watchLoanDuration || getInitialDuration(),
      offer,
    );
  }, [
    watchLoanAmount,
    watchLoanDuration,
    offer,
    latestPrice,
    getInitialAmount,
    getInitialDuration,
  ]);

  const monthlyInstallments = useMemo(() => {
    if (offer && offer.repayment_plan === RepaymentPlan.InterestOnlyMonthly) {
      const loanAmount = watchLoanAmount || getInitialAmount();
      const loanDuration = watchLoanDuration || getInitialDuration();
      const interest = loanAmount * offer?.interest_rate;
      let numberOfPayments = Math.ceil(loanDuration / ONE_MONTH);
      return {
        monthlyInstallments: numberOfPayments,
        amountPerInstallment: interest / numberOfPayments,
      };
    } else {
      return undefined;
    }
  }, [
    watchLoanAmount,
    watchLoanDuration,
    offer,
    getInitialAmount,
    getInitialDuration,
  ]);

  const {
    loading: moonCardsLoading,
    value: maybeMoonCards,
    error: userCardsError,
  } = useAsync(async () => {
    if (paymentType !== LoanProductTypes.PayWithMoon) {
      return [];
    }

    if (await isInUS()) {
      return [];
    } else {
      return getUserCards();
    }
  });

  if (userCardsError) {
    console.error(`Could not load moon cards`);
    toast.error("Failed loading credit cards");
  }

  const moonCards = maybeMoonCards || [];

  // Navigation functions
  const stepRoutes = ["configure", "payment", "review"] as const;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const nextStepRoute = stepRoutes[currentStep + 1];
      const queryString = searchParams.toString();
      navigate(
        `/loan-offers/${offerId}/${nextStepRoute}${queryString ? `?${queryString}` : ""}`,
      );
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const prevStepRoute = stepRoutes[currentStep - 1];
      const queryString = searchParams.toString();
      navigate(
        `/loan-offers/${offerId}/${prevStepRoute}${queryString ? `?${queryString}` : ""}`,
      );
    }
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex <= currentStep || stepIndex === currentStep + 1) {
      const targetStepRoute = stepRoutes[stepIndex];
      const queryString = searchParams.toString();
      navigate(
        `/loan-offers/${offerId}/${targetStepRoute}${queryString ? `?${queryString}` : ""}`,
      );
    }
  };

  // Handle step progression - now just navigate to next step
  const handleContinue = async () => {
    // Validate current step
    let fieldsToValidate: (
      | "loanAmount"
      | "loanDuration"
      | "bitcoinAddress"
      | "stablecoinAddress"
      | "moonCardId"
    )[] = [];

    if (currentStep === 0) {
      // Step 1: Validate loan amount and duration
      fieldsToValidate = ["loanAmount", "loanDuration"];
    } else if (currentStep === 1) {
      // Step 2: Validate payment setup fields
      fieldsToValidate = ["bitcoinAddress"];
      if (needsStablecoinAddress) {
        fieldsToValidate.push("stablecoinAddress");
      }
      if (paymentType === LoanProductTypes.PayWithMoon) {
        fieldsToValidate.push("moonCardId");
      }

      // Check additional validation for non-form fields
      if (needsBanking && !fiatTransferDetailsConfirmed) {
        toast.error("Please provide banking details before continuing");
        return;
      }
      if (needsKyc && !kycFormDialogConfirmed) {
        toast.error("Please complete KYC verification before continuing");
        return;
      }
      if (bringinButNoKey) {
        toast.error("Please connect your Bringin API key before continuing");
        return;
      }
    }

    const currentStepValid =
      fieldsToValidate.length === 0
        ? true
        : await form.trigger(fieldsToValidate);

    if (currentStepValid) {
      nextStep();
    }
  };

  const onSubmit = async (data: LoanFormData) => {
    try {
      if (!offer) {
        toast.error("Loan offer not loaded");
        return;
      }

      // Validate additional fields
      if (needsStablecoinAddress && !data.stablecoinAddress) {
        toast.error("Please provide a receiving address for your loan");
        return;
      }

      if (needsBanking && !fiatTransferDetailsConfirmed) {
        toast.error("Please provide banking details");
        return;
      }

      if (needsKyc && !kycFormDialogConfirmed) {
        toast.error("Please complete KYC verification");
        return;
      }

      setIsCreatingRequest(true);
      const borrowerNpub = await getNpub();

      let pk: string;
      let path: string;

      if (ownPk && ownPath) {
        pk = ownPk;
        path = ownPath;
      } else {
        const pkAndPath = await getPkAndDerivationPath();
        pk = pkAndPath.pubkey;
        path = pkAndPath.path;
      }

      // Determine loan type based on payment option
      let loanType: LoanType;
      switch (paymentType) {
        case LoanProductTypes.PayWithMoon:
          loanType = LoanType.PayWithMoon;
          break;
        case LoanProductTypes.StableCoins:
          loanType = LoanType.StableCoin;
          break;
        case LoanProductTypes.Fiat:
          loanType = LoanType.Fiat;
          break;
        case LoanProductTypes.Bringin:
          loanType = LoanType.Bringin;
          break;
        default:
          if (LoanAssetHelper.isFiat(offer.loan_asset)) {
            loanType = LoanType.Fiat;
          } else {
            loanType = LoanType.StableCoin;
          }
          break;
      }

      let moonCardId: string | undefined = undefined;
      if (
        data.moonCardId &&
        data.moonCardId !== NEW_CARD_CONSTANT &&
        data.moonCardId.trim().length > 0
      ) {
        moonCardId = data.moonCardId.trim();
      }

      const res = await postContractRequest({
        id: offer.id,
        loan_amount: data.loanAmount,
        duration_days: data.loanDuration,
        borrower_btc_address: data.bitcoinAddress,
        borrower_npub: borrowerNpub,
        borrower_pk: pk,
        borrower_derivation_path: path,
        borrower_loan_address: data.stablecoinAddress || "",
        loan_type: loanType,
        moon_card_id: moonCardId ? moonCardId : undefined,
        fiat_loan_details: encryptedFiatTransferDetails,
      });

      if (res !== undefined) {
        toast.success("Loan request sent successfully!");
        navigate(`/my-contracts/${res.id}`);
      } else {
        toast.error("Failed to submit loan request");
      }
    } catch (error) {
      console.error("Error submitting loan request:", error);
      toast.error(`Error: ${error}`);
    } finally {
      setIsCreatingRequest(false);
    }
  };

  if (error) {
    toast.error("Failed to load loan offer");
    return (
      <div className="min-h-screen">
        <div className="container mx-auto max-w-7xl p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load loan offer. Please try again later.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (loading || !offer) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto max-w-7xl p-6">
          <Skeleton className="mb-4 h-8 w-32" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl p-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to offers
          </Button>
        </div>
        <div className={"mb-4"}>
          <Card className="border-2">
            <CardHeader>
              <div className="flex flex-col space-y-4">
                <LenderStatsLabel
                  {...offer.lender}
                  showAvatar={true}
                  ratingTextAlign={"left"}
                />

                {/* Loan Offer Details */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">
                        Amount Range
                      </p>
                      <p className="text-sm font-medium">
                        {formatCurrency(
                          offer.loan_amount_min,
                          LoanAssetHelper.toCurrency(offer.loan_asset),
                        )}
                        {" - "}
                        {formatCurrency(
                          offer.loan_amount_max,
                          LoanAssetHelper.toCurrency(offer.loan_asset),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">
                        Duration
                      </p>
                      <p className="text-sm font-medium">
                        {offer.duration_days_min} - {offer.duration_days_max}{" "}
                        days
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">
                        Interest Rate
                      </p>
                      <p className="text-sm font-medium">
                        {(offer.interest_rate * 100).toFixed(1)}% APR
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">
                        LTV Ratio
                      </p>
                      <p className="text-sm font-medium">
                        {(offer.min_ltv * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Step Navigation */}
        <div className="mb-6">
          <div className="hidden sm:block">
            <StepWizard
              steps={steps}
              currentStep={currentStep}
              onStepClick={goToStep}
            />
          </div>
          <MobileStepWizard steps={steps} currentStep={currentStep} />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Step Content */}
            <div className="min-h-[600px]">
              {currentStep === 0 && (
                <LoanConfigurationStep
                  control={form.control}
                  offer={offer}
                  calculation={calculation}
                  monthlyInstallments={monthlyInstallments}
                />
              )}

              {currentStep === 1 && (
                <PaymentSetupStep
                  control={form.control}
                  offer={offer}
                  paymentType={paymentType}
                  needsStablecoinAddress={needsStablecoinAddress === true}
                  needsBanking={needsBanking === true}
                  fiatTransferDetailsConfirmed={fiatTransferDetailsConfirmed}
                  setFiatTransferDetailsConfirmed={
                    setFiatTransferDetailsConfirmed
                  }
                  setEncryptedFiatTransferDetails={
                    setEncryptedFiatTransferDetails
                  }
                  needsKyc={needsKyc === true}
                  isKycChecked={isKycChecked}
                  setIsKycChecked={setIsKycChecked}
                  kycFormDialogConfirmed={kycFormDialogConfirmed}
                  setKycFormDialogConfirmed={setKycFormDialogConfirmed}
                  moonCards={moonCards}
                  moonCardsLoading={moonCardsLoading}
                  bringinButNoKey={bringinButNoKey}
                  getPkAndDerivationPath={getPkAndDerivationPath}
                  encryptFiatLoanDetailsBorrower={
                    encryptFiatLoanDetailsBorrower
                  }
                  setOwnPk={setOwnPk}
                  setOwnPath={setOwnPath}
                />
              )}

              {currentStep === 2 && (
                <ReviewConfirmStep
                  control={form.control}
                  offer={offer}
                  paymentType={paymentType}
                  watchLoanAmount={watchLoanAmount || getInitialAmount()}
                  watchLoanDuration={watchLoanDuration || getInitialDuration()}
                  calculation={calculation}
                  monthlyInstallments={monthlyInstallments}
                  isCreatingRequest={isCreatingRequest}
                  confirmLoanTerms={confirmLoanTerms}
                />
              )}

              {/* Navigation Buttons */}
              {currentStep < steps.length - 1 && (
                <div className="mt-12 flex items-center justify-between border-t pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="min-w-24"
                  >
                    {currentStep > 0 ? "Previous" : ""}
                  </Button>
                  <div className="text-muted-foreground text-center text-sm">
                    Step {currentStep + 1} of {steps.length}
                  </div>
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="min-w-32"
                  >
                    {currentStep === steps.length - 2 ? "Review" : "Continue"}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default LoanOfferDetails;
