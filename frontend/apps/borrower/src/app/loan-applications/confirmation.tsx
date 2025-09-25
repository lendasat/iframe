import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Network, validate } from "bitcoin-address-validation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, FileWarning, Info, Loader2 } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
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
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@frontend/shadcn";
import {
  LoanProductOption,
  LoanType,
  RepaymentPlan,
  useAuth,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { useWallet } from "@frontend/browser-wallet";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAddressInputField,
  LoanAsset,
  LoanAssetHelper,
  newFormatCurrency,
  ONE_YEAR,
  usePriceForCurrency,
} from "@frontend/ui-shared";
import { ToS } from "../loan-offers/tos";

const confirmationFormSchema = z.object({
  bitcoinAddress: z
    .string()
    .min(1, "Address required.")
    .refine(
      (data: string) => validateBitcoinAddress(data),
      "Invalid Bitcoin address.",
    ),
  loanAddress: z.string().optional(),
});

type ConfirmationFormValues = z.infer<typeof confirmationFormSchema>;

interface ConfirmationProps {
  selectedAssetType: LoanAsset;
  selectedLoanAmountMin: string;
  selectedLoanAmountMax: string;
  selectedLoanDurationMin: string;
  selectedLoanDurationMax: string;
  selectedInterestRate: string;
  originationFee: number;
  ltv: string;
  disabled: boolean;
}

const validateBitcoinAddress = (address: string) => {
  let network = Network.mainnet;
  if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    network = Network.testnet;
  } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
    network = Network.regtest;
  }

  return validate(address, network);
};

export const Confirmation = ({
  selectedAssetType,
  selectedLoanAmountMin: selectedLoanAmountMinString,
  selectedLoanAmountMax: selectedLoanAmountMaxString,
  selectedLoanDurationMin: selectedLoanDurationMinString,
  selectedLoanDurationMax: selectedLoanDurationMaxString,
  selectedInterestRate,
  originationFee,
  ltv: ltvAsString,
  disabled,
}: ConfirmationProps) => {
  const navigate = useNavigate();
  const { getNpub, getPkAndDerivationPath } = useWallet();
  const { postLoanApplication } = useHttpClientBorrower();
  const { user } = useAuth();
  // TODO: we should be using skeletons while the price is loading
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(selectedAssetType),
  );

  const [createRequestError, setCreateRequestError] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);

  // Parse numeric values
  const selectedLoanAmountMin = parseInt(selectedLoanAmountMinString || "0");
  const selectedLoanAmountMax = parseInt(selectedLoanAmountMaxString || "0");
  const selectedLoanDurationMin = parseInt(
    selectedLoanDurationMinString || "0",
  );
  const selectedLoanDurationMax = parseInt(
    selectedLoanDurationMaxString || "0",
  );
  const ltv = (parseFloat(ltvAsString) || 50.0) / 100;

  // Calculate loan details for MIN values
  const interestRate = Number.parseFloat(selectedInterestRate);
  const actualInterestMin = interestRate / (ONE_YEAR / selectedLoanDurationMin);
  const actualInterestUsdAmountMin =
    (selectedLoanAmountMin * actualInterestMin) / 100.0;

  // Calculate loan details for MAX values
  const actualInterestMax = interestRate / (ONE_YEAR / selectedLoanDurationMax);
  const actualInterestUsdAmountMax =
    (selectedLoanAmountMax * actualInterestMax) / 100.0;

  // Outstanding balances
  const outstandingBalanceUsdMax =
    selectedLoanAmountMax + actualInterestUsdAmountMax;

  // Collateral calculations for MAX
  const collateralAmountMax = outstandingBalanceUsdMax / ltv;
  const collateralAmountBtcMax = collateralAmountMax / latestPrice;

  // Calculate fees
  const discountedFee = user?.first_time_discount_rate || 0.0;
  const isDiscountedFeeApplied = discountedFee ? discountedFee > 0 : false;
  const discountedOriginationFee =
    originationFee - originationFee * discountedFee;

  const originationFeeUsdMax = selectedLoanAmountMax * discountedOriginationFee;
  const originationFeeBtcMax = originationFeeUsdMax / latestPrice;

  const totalDepositAmountBTCMax =
    collateralAmountBtcMax + originationFeeBtcMax;
  const totalDepositAmountMax = collateralAmountMax + originationFeeUsdMax;

  // Liquidation prices
  const liquidationPriceMax =
    outstandingBalanceUsdMax / (collateralAmountBtcMax * 0.9);

  // Setup form with react-hook-form and zod validation
  const form = useForm<ConfirmationFormValues>({
    resolver: zodResolver(confirmationFormSchema),
    defaultValues: {
      bitcoinAddress: "",
      loanAddress: "",
    },
  });

  // Determine if stablecoin loan address is required
  const showStablecoinLoadAddressInput = Boolean(
    selectedAssetType && LoanAssetHelper.isStableCoin(selectedAssetType),
  );

  const showFiatAddressInput = Boolean(
    selectedAssetType && LoanAssetHelper.isFiat(selectedAssetType),
  );

  // Handle form submission
  const onSubmit = async (data: ConfirmationFormValues) => {
    try {
      if (!validateBitcoinAddress(data.bitcoinAddress)) {
        setCreateRequestError("Invalid bitcoin refund address provided");
        return;
      }
      setIsCreatingRequest(true);
      const borrowerNpub = await getNpub();
      const borrowerPk = await getPkAndDerivationPath();

      if (
        LoanAssetHelper.isStableCoin(selectedAssetType) &&
        (!data.loanAddress || data.loanAddress.trim().length === 0)
      ) {
        setCreateRequestError("No loan address provided");
        return;
      }

      let loan_type = LoanType.StableCoin;
      if (LoanAssetHelper.isFiat(selectedAssetType)) {
        loan_type = LoanType.Fiat;
      }

      const res = await postLoanApplication({
        ltv,
        loan_amount_min: selectedLoanAmountMin,
        loan_amount_max: selectedLoanAmountMax,
        duration_days_min: selectedLoanDurationMin,
        duration_days_max: selectedLoanDurationMax,
        borrower_npub: borrowerNpub,
        borrower_pk: borrowerPk.pubkey,
        borrower_derivation_path: borrowerPk.path,
        loan_asset: selectedAssetType,
        loan_type,
        interest_rate: interestRate / 100.0,
        borrower_loan_address: data.loanAddress || "",
        borrower_btc_address: data.bitcoinAddress,
        // Only bullet loan applications supported for now. We should just need to adapt the UI for
        // this.
        repayment_plan: RepaymentPlan.Bullet,
      });

      if (res !== undefined) {
        navigate(`/loan-applications`);
      } else {
        setCreateRequestError("Failed at posting request.");
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setCreateRequestError(`${error}`);
    } finally {
      setIsCreatingRequest(false);
    }
  };

  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">
            Conditions to borrow{" "}
            <strong>
              {formatCurrency(
                selectedLoanAmountMin || 0,
                LoanAssetHelper.toCurrency(selectedAssetType),
              )}
              {selectedLoanAmountMin !== selectedLoanAmountMax && (
                <>
                  {" - "}
                  {formatCurrency(
                    selectedLoanAmountMax || 0,
                    LoanAssetHelper.toCurrency(selectedAssetType),
                  )}
                </>
              )}
            </strong>{" "}
            {LoanAssetHelper.print(selectedAssetType)} for{" "}
            {getFormatedStringFromDays(selectedLoanDurationMin)}
            {selectedLoanDurationMin !== selectedLoanDurationMax && (
              <> - {getFormatedStringFromDays(selectedLoanDurationMax)}</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1">
              <span>Liquidation price</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Price at which your collateral may be liquidated.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold capitalize">
                {liquidationPriceMax &&
                  newFormatCurrency({
                    value: liquidationPriceMax,
                    currency: LoanAssetHelper.toCurrency(selectedAssetType),
                    maxFraction: 0,
                    minFraction: 0,
                  })}
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1">
              <span>Interest</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Interest rate for the loan duration.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-col items-end">
              {(selectedLoanDurationMin !== ONE_YEAR ||
                selectedLoanDurationMax !== ONE_YEAR) && (
                <div className="flex gap-2">
                  <span className="text-sm font-semibold">
                    {actualInterestMin.toFixed(2)}%
                    {selectedLoanDurationMin !== selectedLoanDurationMax && (
                      <> - {actualInterestMax.toFixed(2)}%</>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    ({interestRate.toFixed(1)}% p.a.)
                  </span>
                </div>
              )}
              {selectedLoanDurationMin === ONE_YEAR &&
                selectedLoanDurationMax === ONE_YEAR && (
                  <span className="text-sm font-semibold">
                    {actualInterestMin.toFixed(2)}%
                    {selectedLoanDurationMin !== selectedLoanDurationMax && (
                      <> - {actualInterestMax.toFixed(2)}%</>
                    )}{" "}
                    p.a.
                  </span>
                )}
              <span className="text-muted-foreground text-xs">
                ≈{" "}
                {formatCurrency(
                  actualInterestUsdAmountMin,
                  LoanAssetHelper.toCurrency(selectedAssetType),
                  1,
                  1,
                )}
                {actualInterestUsdAmountMin !== actualInterestUsdAmountMax && (
                  <>
                    {" - "}
                    {formatCurrency(
                      actualInterestUsdAmountMax,
                      LoanAssetHelper.toCurrency(selectedAssetType),
                      1,
                      1,
                    )}
                  </>
                )}{" "}
                in total
              </span>
            </div>
          </div>

          <Separator />
          <div className="flex items-start justify-between">
            <div className="flex flex-row items-center gap-1">
              <div className={"flex items-center gap-2"}>
                <p>Collateral</p>

                <Badge variant="outline">{(ltv * 100).toFixed(0)}% LTV</Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The required collateral as per the LTV.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm capitalize">
                up to{" "}
                <span className="font-semibold">
                  {collateralAmountBtcMax.toFixed(8)} BTC
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                ≈ up to{" "}
                <span className="font-medium">
                  {formatCurrency(
                    collateralAmountMax,
                    LoanAssetHelper.toCurrency(selectedAssetType),
                  )}
                </span>
              </span>
            </div>
          </div>

          <Separator />
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span>Origination fee</span>
              {isDiscountedFeeApplied && (
                <span className="text-muted-foreground text-xs">
                  {-(discountedFee * 100).toFixed(2)}% discount applied
                </span>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span
                className={`text-sm capitalize ${
                  discountedFee === 1 ? "line-through" : ""
                }`}
              >
                up to{" "}
                <span className="font-semibold">
                  {originationFeeBtcMax.toFixed(8)} BTC
                </span>
              </span>
              <span
                className={`text-muted-foreground text-xs ${
                  discountedFee === 1 ? "line-through" : ""
                }`}
              >
                ≈ up to{" "}
                <span className="font-medium">
                  {formatCurrency(
                    originationFeeUsdMax,
                    LoanAssetHelper.toCurrency(selectedAssetType),
                  )}
                </span>
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1">
              <div>
                <div className={"flex items-center gap-2"}>
                  <p>Total funding amount</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The total deposit amount including collateral and
                          origination fee.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm capitalize">
                up to{" "}
                <span className="font-semibold">
                  {totalDepositAmountBTCMax.toFixed(8)} BTC
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                ≈ up to{" "}
                <span className="font-medium">
                  {formatCurrency(
                    totalDepositAmountMax,
                    LoanAssetHelper.toCurrency(selectedAssetType),
                  )}
                </span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardContent className="space-y-6 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="bitcoinAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Collateral refund address
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0"
                      ></Button>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          validateBitcoinAddress(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Your collateral will be sent to this address after
                      repayment.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showStablecoinLoadAddressInput && (
                <FormField
                  control={form.control}
                  name="loanAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan address</FormLabel>
                      <FormControl>
                        <LoanAddressInputField
                          loanAddress={field.value || ""}
                          setLoanAddress={field.onChange}
                          loanAsset={selectedAssetType}
                          renderWarning={true}
                          placeholder="Enter repayment wallet address"
                          hideButton={hideWalletConnectButton}
                          setHideButton={setHideWalletConnectButton}
                        />
                      </FormControl>
                      <FormDescription>
                        The loan amount will be sent to this address.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {showFiatAddressInput && (
                <Alert variant="warning">
                  <FileWarning className="h-4 w-4" />
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>
                    Once a lender accepts your loan request, you will need to
                    provide your bank details.
                  </AlertDescription>
                </Alert>
              )}

              {createRequestError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{createRequestError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col">
                <Button type="submit" disabled={isCreatingRequest || disabled}>
                  {isCreatingRequest ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Please wait
                    </>
                  ) : (
                    "Submit loan request"
                  )}
                </Button>
              </div>

              <ToS product={LoanProductOption.StableCoins} />
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
