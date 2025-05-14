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
  useAuth,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { useWallet } from "@frontend/browser-wallet";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAsset,
  LoanAssetHelper,
  newFormatCurrency,
  ONE_YEAR,
  usePrice,
} from "@frontend/ui-shared";
import { ToS } from "../loan-offers/tos";

// Zod schema for form validation
const confirmationFormSchema = z.object({
  bitcoinAddress: z.string().min(1, "Bitcoin address is required"),
  loanAddress: z.string().optional(),
});

type ConfirmationFormValues = z.infer<typeof confirmationFormSchema>;

interface ConfirmationProps {
  selectedAssetType: LoanAsset;
  selectedLoanAmount: string;
  selectedLoanDuration: string;
  selectedInterestRate: string;
  originationFee: number;
  ltv: string;
}

export const Confirmation = ({
  selectedAssetType,
  selectedLoanAmount: selectedLoanAmountString,
  selectedLoanDuration: selectedLoanDurationString,
  selectedInterestRate,
  originationFee,
  ltv: ltvAsString,
}: ConfirmationProps) => {
  const navigate = useNavigate();
  const { getNpub, getPkAndDerivationPath } = useWallet();
  const { postLoanApplication } = useHttpClientBorrower();
  const { latestPrice } = usePrice();
  const { user } = useAuth();

  const [bitcoinAddressValid, setBitcoinAddressValid] = useState(false);
  const [createRequestError, setCreateRequestError] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [fiatDetailsProvided, setFiatDetailsProvided] = useState(false);

  // Parse numeric values
  const selectedLoanAmount = parseInt(selectedLoanAmountString || "0");
  const selectedLoanDuration = parseInt(selectedLoanDurationString || "0");
  const ltv = (parseFloat(ltvAsString) || 50.0) / 100;

  // Calculate loan details
  const interestRate = Number.parseFloat(selectedInterestRate);
  const actualInterest = interestRate / (ONE_YEAR / selectedLoanDuration);
  const actualInterestUsdAmount = (selectedLoanAmount * actualInterest) / 100.0;

  // Collataral and its value
  const collateralUsdAmount =
    (selectedLoanAmount + actualInterestUsdAmount) / ltv;
  const collateralAmountBtc = collateralUsdAmount / latestPrice;

  // Calculate fees
  const discountedFee = user?.first_time_discount_rate || 0.0;
  const isDiscountedFeeApplied = discountedFee ? discountedFee > 0 : false;
  const discountedOriginationFee =
    originationFee - originationFee * discountedFee;

  const originationFeeUsd = selectedLoanAmount * discountedOriginationFee;
  const originationFeeBtc = originationFeeUsd / latestPrice;

  // How much the user needs to deposit
  const totalDepositAmountBTC = collateralAmountBtc + originationFeeBtc;
  const totalDepositAmountUsd = collateralUsdAmount + originationFeeUsd;

  // The total amount the user will owe
  const outstandingBalanceUsd = selectedLoanAmount + actualInterestUsdAmount;

  // Calculate liquidation price
  const liquidationPrice = outstandingBalanceUsd / (collateralAmountBtc * 0.9);

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

  // Validate Bitcoin address based on network
  const validateBitcoinAddress = (address: string) => {
    let network = Network.mainnet;
    if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
      network = Network.testnet;
    } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
      network = Network.regtest;
    }

    const valid = validate(address, network);
    setBitcoinAddressValid(valid);
    return valid;
  };

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
        loan_amount: selectedLoanAmount,
        duration_days: selectedLoanDuration,
        borrower_npub: borrowerNpub,
        borrower_pk: borrowerPk.pubkey,
        borrower_derivation_path: borrowerPk.path,
        loan_asset: selectedAssetType,
        loan_type,
        interest_rate: interestRate / 100.0,
        borrower_loan_address: data.loanAddress || "",
        borrower_btc_address: data.bitcoinAddress,
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">
            Summary to borrow{" "}
            <strong>{formatCurrency(selectedLoanAmount || 0)}</strong>{" "}
            {LoanAssetHelper.print(selectedAssetType)} for{" "}
            {getFormatedStringFromDays(selectedLoanDuration)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-start">
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
                    <p>Price at which your collateral may be liquidated</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span
              className={`font-semibold text-sm capitalize ${
                discountedFee === 1 ? "line-through" : ""
              }`}
            >
              {newFormatCurrency({
                value: liquidationPrice,
                maxFraction: 0,
                minFraction: 1,
              })}
            </span>
          </div>

          <Separator />

          <div className="flex justify-between items-start">
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
                    <p>Interest rate for the loan duration</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-col items-end">
              {selectedLoanDuration !== ONE_YEAR && (
                <div className="flex gap-2">
                  <span className="font-semibold text-sm">
                    {actualInterest.toFixed(2)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({interestRate.toFixed(1)}% p.a.)
                  </span>
                </div>
              )}
              {selectedLoanDuration === ONE_YEAR && (
                <span className="font-semibold text-sm">
                  {actualInterest.toFixed(2)}% p.a.
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
              </span>
            </div>
          </div>

          <Separator />
          <div className="flex justify-between items-start">
            <div className="flex flex-row items-center gap-1">
              <div className={"flex gap-2 items-center"}>
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
                      <p>Loan-to-Value ratio determines required collateral</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-semibold text-sm capitalize">
                {collateralAmountBtc.toFixed(8)} BTC
              </span>
              <span className="text-xs text-muted-foreground">
                ≈ {formatCurrency(collateralUsdAmount)}
              </span>
            </div>
          </div>

          <Separator />
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span>Origination fee</span>
              {isDiscountedFeeApplied && (
                <span className="text-xs text-muted-foreground">
                  {-(discountedFee * 100).toFixed(2)}% discount applied
                </span>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span
                className={`font-semibold text-sm capitalize ${
                  discountedFee === 1 ? "line-through" : ""
                }`}
              >
                {originationFeeBtc.toFixed(8)} BTC
              </span>
              <span
                className={`text-xs text-muted-foreground ${
                  discountedFee === 1 ? "line-through" : ""
                }`}
              >
                ≈ {formatCurrency(originationFeeUsd)}
              </span>
            </div>
          </div>

          <Separator />
          <Separator />

          <div className="flex justify-between items-start">
            <div className="flex items-center gap-1">
              <div>
                <div className={"flex gap-2 items-center"}>
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
                          The total deposit amount includes the collateral plus
                          origination fee.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-semibold text-sm capitalize">
                {totalDepositAmountBTC.toFixed(8)} BTC
              </span>
              <span className="text-xs text-muted-foreground">
                ≈ {formatCurrency(totalDepositAmountUsd)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardContent className="pt-6 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="bitcoinAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Collateral refund address
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
                              The Bitcoin address where you want your collateral
                              returned upon loan repayment.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                      This address will be used to return the collateral to you
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
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>
                        This address will be used to transfer the loan amount
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
                    Once a lender accepts your loan request, you will be
                    prompted for your banking details.
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
                <Button type="submit" disabled={isCreatingRequest}>
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
