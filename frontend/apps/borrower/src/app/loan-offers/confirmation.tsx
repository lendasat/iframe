import {
  FiatLoanDetails,
  LoanProductOption,
  RepaymentPlan,
} from "@frontend/http-client-borrower";
import { useWallet } from "@frontend/browser-wallet";
import {
  LoanType,
  useAuth,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  AbbreviationExplanationInfo,
  AddFiatDetailsDialog,
  formatCurrency,
  getFormatedStringFromDays,
  LenderStatsLabel,
  LoanAddressInputField,
  LoanAsset,
  LoanAssetHelper,
  ONE_YEAR,
  usePriceForCurrency,
} from "@frontend/ui-shared";
import {
  Button,
  CardDescription,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@frontend/shadcn";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { Skeleton } from "@frontend/shadcn";
import axios from "axios";
import { Network, validate } from "bitcoin-address-validation";
import { useState } from "react";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import { KycDialog } from "./kyc-dialog";
import { MoonCardDropdown } from "./MoonCardDropdown";
import { ToS } from "./tos";
import { toast } from "sonner";

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

interface ConfirmationProps {
  selectedProduct?: LoanProductOption;
  selectedOfferId?: string;
  selectedLoanAmount?: string;
  selectedLoanDuration?: string;
  selectedLoanAsset: LoanAsset;
}

export const Confirmation = ({
  selectedProduct,
  selectedOfferId,
  selectedLoanAmount: selectedLoanAmountString,
  selectedLoanDuration: selectedLoanDurationString,
  selectedLoanAsset,
}: ConfirmationProps) => {
  const navigate = useNavigate();
  const { getNpub, getPkAndDerivationPath, encryptFiatLoanDetailsBorrower } =
    useWallet();
  const { hasBringinApiKey: getHasBringinApiKey } = useHttpClientBorrower();

  const { loading: apiKeyLoading, value: maybeApiKey } = useAsync(async () => {
    return await getHasBringinApiKey();
  });

  const hasBriningApiKey = !apiKeyLoading && maybeApiKey;

  const { getLoanOffer, getUserCards, postContractRequest } =
    useHttpClientBorrower();
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(selectedLoanAsset),
  );
  // TODO: we should be using skeletons while the price is loading
  const { user } = useAuth();

  const [bitcoinAddressInputError, setBitcoinAddressInputError] = useState("");
  const [bitcoinAddressValid, setBitcoinAddressValid] = useState(false);
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [moonCardId, setMoonCardId] = useState<string | undefined>();
  const [loanAddress, setLoanAddress] = useState("");
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);
  const [createRequestError, setCreateRequestError] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [fiatTransferDetailsConfirmed, setFiatTransferDetailsConfirmed] =
    useState(false);
  const [encryptedFiatTransferDetails, setEncryptedFiatTransferDetails] =
    useState<FiatLoanDetails>();
  const [ownPk, setOwnPk] = useState<string | undefined>(undefined);
  const [ownPath, setOwnPath] = useState<string | undefined>(undefined);
  const [isKycChecked, setIsKycChecked] = useState(false);
  const [kycFormDialogConfirmed, setKycFormDialogConfirmed] = useState(false);

  const selectedLoanAmount = parseInt(selectedLoanAmountString || "0");
  const selectedLoanDuration = parseInt(selectedLoanDurationString || "0");

  const {
    loading,
    value: selectedOffer,
    error,
  } = useAsync(async () => {
    if (!selectedOfferId) {
      return;
    }
    return getLoanOffer(selectedOfferId);
  }, [selectedOfferId]);

  const {
    loading: moonCardsLoading,
    value: maybeMoonCards,
    error: userCardsError,
  } = useAsync(async () => {
    if (await isInUS()) {
      return [];
    } else {
      return getUserCards();
    }
  });

  const moonCards = maybeMoonCards || [];

  const isStillLoading = loading || !selectedOffer;
  const ltv = selectedOffer?.min_ltv || 0;
  const interestRate = selectedOffer?.interest_rate || 0;
  const actualInterest = interestRate / (ONE_YEAR / selectedLoanDuration);
  const actualInterestAmountUsd = selectedLoanAmount * actualInterest;

  // This is the total actual interest to be paid over the loan duration times the LTV.
  // This is to cover potential price drops
  const collateralAmountBtc =
    (selectedLoanAmount + actualInterestAmountUsd) / latestPrice / ltv;

  const discountedFee = user?.first_time_discount_rate || 0.0;
  const isDiscountedFeeApplied = discountedFee ? discountedFee > 0 : false;

  const originationFee = selectedOffer?.origination_fee[0].fee || 0.0;
  const discountedOriginationFee =
    originationFee - originationFee * discountedFee;
  const originationFeeUsd = selectedLoanAmount * discountedOriginationFee;
  const originationFeeBtc = originationFeeUsd / latestPrice;

  // Total needed collateral is the sum of
  //  + collateral amount = loan amount / LTV
  //  + actual interest / LTV
  //  + origination fee
  const totalFundingAmountBtc = collateralAmountBtc + originationFeeBtc;
  const totalFundingAmountUsd = totalFundingAmountBtc * latestPrice;

  const loanAsset = selectedOffer?.loan_asset;

  const onBitcoinAddressChange = (address: string) => {
    let network = Network.mainnet;
    if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
      network = Network.testnet;
    } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
      network = Network.regtest;
    }

    const valid = validate(address, network);
    if (!valid) {
      setBitcoinAddressInputError("Invalid address");
      setBitcoinAddressValid(false);
    } else {
      setBitcoinAddressInputError("");
      setBitcoinAddressValid(true);
    }
    setBitcoinAddress(address);
  };

  const unlockWalletOrCreateOfferRequest = async () => {
    try {
      if (!selectedOfferId) {
        setIsCreatingRequest(false);
        setCreateRequestError("No offer selected");
        return;
      }

      if (
        !bitcoinAddress ||
        bitcoinAddress.trim().length === 0 ||
        !bitcoinAddressValid
      ) {
        setCreateRequestError("No valid bitcoin address provided");
        return;
      }

      setIsCreatingRequest(true);
      const borrowerNpub = await getNpub();

      let loanType = LoanType.StableCoin;
      switch (selectedProduct) {
        case LoanProductOption.PayWithMoonDebitCard:
          loanType = LoanType.PayWithMoon;
          break;
        case LoanProductOption.StableCoins:
          loanType = LoanType.StableCoin;
          break;
        case LoanProductOption.Fiat:
          loanType = LoanType.Fiat;
          break;
        case LoanProductOption.Bringin:
          loanType = LoanType.Bringin;
          break;
      }

      if (
        loanType === LoanType.StableCoin &&
        (!loanAddress || loanAddress.trim().length === 0)
      ) {
        setCreateRequestError("No address provided");
        return;
      }

      if (loanType === LoanType.Fiat && !encryptedFiatTransferDetails) {
        setCreateRequestError("No bank transfer details provided");
        return;
      }

      if (
        !kycFormDialogConfirmed &&
        Boolean(selectedOffer?.kyc_link && selectedOffer?.kyc_link.length > 0)
      ) {
        setCreateRequestError("KYC form dialog not confirmed");
        return;
      }

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

      const res = await postContractRequest({
        id: selectedOfferId,
        loan_amount: selectedLoanAmount,
        duration_days: selectedLoanDuration,
        borrower_btc_address: bitcoinAddress,
        borrower_npub: borrowerNpub,
        borrower_pk: pk,
        borrower_derivation_path: path,
        borrower_loan_address: loanAddress,
        loan_type: loanType,
        moon_card_id: moonCardId,
        fiat_loan_details: encryptedFiatTransferDetails,
      });

      if (res !== undefined) {
        navigate(`/my-contracts/${res.id}`);
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

  const fiatButNoEncryptedDataPresent =
    loanAsset &&
    LoanAssetHelper.isFiat(loanAsset) &&
    !encryptedFiatTransferDetails;
  const kycButNoKycConfirmed = Boolean(
    selectedOffer?.kyc_link &&
      !kycFormDialogConfirmed &&
      selectedOffer.kyc_link.length > 0,
  );
  const bringinButNoKey =
    selectedProduct === LoanProductOption.Bringin && !hasBriningApiKey;
  const buttonDisabled =
    isStillLoading ||
    fiatButNoEncryptedDataPresent ||
    kycButNoKycConfirmed ||
    bringinButNoKey;

  const showStablecoinLoanAddressInput = Boolean(
    selectedOffer?.loan_asset &&
      LoanAssetHelper.isStableCoin(selectedOffer.loan_asset) &&
      selectedProduct !== LoanProductOption.PayWithMoonDebitCard &&
      selectedProduct !== LoanProductOption.Bringin,
  );

  let estimatedInstallment = 0;
  const dailyInterestRate = interestRate / 360;

  if (selectedOffer?.repayment_plan === RepaymentPlan.InterestOnlyMonthly) {
    if (selectedLoanDuration <= 30) {
      estimatedInstallment =
        selectedLoanAmount * dailyInterestRate * selectedLoanDuration;
    } else {
      estimatedInstallment = selectedLoanAmount * dailyInterestRate * 30;
    }
  } else if (
    selectedOffer?.repayment_plan === RepaymentPlan.InterestOnlyWeekly
  ) {
    if (selectedLoanDuration <= 7) {
      estimatedInstallment =
        selectedLoanAmount * dailyInterestRate * selectedLoanDuration;
    } else {
      estimatedInstallment = selectedLoanAmount * dailyInterestRate * 7;
    }
  }

  const SummaryRow = ({
    label,
    value,
    info,
    loading = false,
  }: {
    label: React.ReactNode;
    value: React.ReactNode;
    info?: React.ReactNode;
    loading?: boolean;
  }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        {label}
        {info && info}
      </div>
      <div className="text-right">
        {loading ? <Skeleton className="h-4 w-20" /> : value}
      </div>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            You will borrow{" "}
            {isStillLoading ? (
              <Skeleton className="inline-block h-5 w-20" />
            ) : (
              <strong>
                {formatCurrency(
                  selectedLoanAmount || 0,
                  LoanAssetHelper.toCurrency(loanAsset),
                )}
              </strong>
            )}{" "}
            for{" "}
            {isStillLoading ? (
              <Skeleton className="inline-block h-5 w-16" />
            ) : (
              getFormatedStringFromDays(selectedLoanDuration)
            )}
          </CardTitle>
          <CardDescription>
            <div className={"flex flex-row gap-2"}>
              <TriangleAlert className="h-4 w-4" />
              {selectedOffer?.repayment_plan ===
                RepaymentPlan.InterestOnlyWeekly &&
                "Weekly interest payments are required."}
              {selectedOffer?.repayment_plan ===
                RepaymentPlan.InterestOnlyMonthly &&
                "Monthly interest payments are required."}
              {selectedOffer?.repayment_plan === RepaymentPlan.Bullet &&
                "Interest and principal are repaid at loan expiry."}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SummaryRow
            label="Lender"
            value={
              <LenderStatsLabel
                showAvatar={false}
                successful_contracts={
                  selectedOffer?.lender.successful_contracts || 0
                }
                showStats={true}
                id={selectedOffer?.lender.id}
                name={selectedOffer?.lender.name}
                ratingTextAlign={"right"}
              />
            }
            loading={isStillLoading}
          />

          <SummaryRow
            label={<div className="flex items-center gap-2">Interest Rate</div>}
            value={
              <div className="text-right">
                {selectedLoanDuration !== ONE_YEAR && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm font-semibold">
                      {(actualInterest * 100).toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({(interestRate * 100).toFixed(1)}% p.a.)
                    </span>
                  </div>
                )}
                {selectedLoanDuration === ONE_YEAR && (
                  <span className="text-muted-foreground text-sm font-semibold">
                    {(actualInterest * 100).toFixed(2)}% p.a.
                  </span>
                )}
                <div className="text-muted-foreground mt-1 text-xs">
                  ≈{" "}
                  {formatCurrency(
                    actualInterestAmountUsd,
                    LoanAssetHelper.toCurrency(loanAsset),
                  )}{" "}
                  in total
                </div>
              </div>
            }
            loading={isStillLoading}
          />

          {(selectedOffer?.repayment_plan ===
            RepaymentPlan.InterestOnlyMonthly ||
            selectedOffer?.repayment_plan ===
              RepaymentPlan.InterestOnlyWeekly) && (
            <SummaryRow
              label={
                <div className={"flex flex-row gap-2"}>
                  <div>
                    {selectedOffer.repayment_plan ===
                    RepaymentPlan.InterestOnlyMonthly
                      ? "Monthly required payments"
                      : "Weekly required payments"}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Monthly interest payments are calculated based on the
                        total interest you owe and are due on a monthly basis.
                        <br />
                        <br />
                        If you miss one payment we will close your loan and
                        return your collateral, deducting any outstanding
                        balance.
                        <br />
                        <br />
                        {loanAsset && (
                          <>
                            - {LoanAssetHelper.print(loanAsset)} in this case.
                          </>
                        )}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              }
              value={
                <span className="text-muted-foreground text-sm font-semibold">
                  {formatCurrency(
                    estimatedInstallment,
                    LoanAssetHelper.toCurrency(loanAsset),
                  )}
                </span>
              }
              loading={isStillLoading}
            />
          )}

          <SummaryRow
            label={
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span>Needed collateral</span>
                  <span className="text-muted-foreground text-xs">
                    ({(ltv * 100).toFixed(0)}% LTV)
                  </span>
                </div>
              </div>
            }
            value={
              <div className="text-right">
                <div className="text-muted-foreground text-sm font-semibold">
                  {formatCurrency(
                    totalFundingAmountUsd,
                    LoanAssetHelper.toCurrency(loanAsset),
                  )}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  ≈ {totalFundingAmountBtc.toFixed(8)} BTC
                </div>
              </div>
            }
            loading={isStillLoading}
          />

          <SummaryRow
            label={
              <div className="flex flex-col">
                <span>Origination fee</span>
                {isDiscountedFeeApplied && (
                  <span className="text-muted-foreground text-xs">
                    {-(discountedFee * 100).toFixed(2)}% discount applied
                  </span>
                )}
              </div>
            }
            value={
              <div className="text-right">
                <div
                  className={`text-muted-foreground text-sm font-semibold ${discountedFee === 1 ? "line-through" : ""}`}
                >
                  {formatCurrency(
                    originationFeeUsd,
                    LoanAssetHelper.toCurrency(loanAsset),
                  )}
                </div>
                <div
                  className={`text-muted-foreground mt-1 text-xs ${discountedFee === 1 ? "line-through" : ""}`}
                >
                  ≈ {originationFeeBtc.toFixed(8)} BTC
                </div>
              </div>
            }
            loading={isStillLoading}
          />

          <SummaryRow
            label="Loan Asset"
            value={
              <span className="text-muted-foreground text-sm font-semibold capitalize">
                {loanAsset ? LoanAssetHelper.print(loanAsset) : ""}
              </span>
            }
            loading={isStillLoading}
          />

          {(error || userCardsError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error?.message || userCardsError?.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Collateral Refund Address */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="bitcoin-address">Collateral Refund Address</Label>
              <AbbreviationExplanationInfo
                header="Collateral Refund Address"
                subHeader=""
                description="The Bitcoin address where you want your collateral returned upon loan repayment."
              >
                <a
                  href="https://faq.lendasat.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Info className="h-4 w-4" />
                </a>
              </AbbreviationExplanationInfo>
            </div>
            {isStillLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="space-y-2">
                <Input
                  id="bitcoin-address"
                  type="text"
                  value={bitcoinAddress}
                  onChange={(e) => onBitcoinAddressChange(e.target.value)}
                  className="text-sm font-semibold"
                />
                <p className="text-muted-foreground text-xs">
                  This address will be used to return the bitcoin collateral to
                  you
                </p>
                {bitcoinAddressInputError && (
                  <p className="text-destructive text-sm">
                    {bitcoinAddressInputError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fiat Transfer Details */}
          {loanAsset && LoanAssetHelper.isFiat(loanAsset) && (
            <div className="space-y-2">
              <Label>Loan transfer details</Label>
              {isStillLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <AddFiatDetailsDialog
                  onComplete={async (data) => {
                    const pkAndPath = await getPkAndDerivationPath();
                    setOwnPk(pkAndPath.pubkey);
                    setOwnPath(pkAndPath.path);

                    const fiatLoanDetails =
                      await encryptFiatLoanDetailsBorrower(
                        data,
                        pkAndPath.pubkey,
                        selectedOffer.lender_pk,
                      );
                    setEncryptedFiatTransferDetails(fiatLoanDetails);
                    setFiatTransferDetailsConfirmed(true);
                    toast.success("Fiat Details Updated");
                  }}
                >
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={fiatTransferDetailsConfirmed}
                  >
                    Provide bank details
                  </Button>
                </AddFiatDetailsDialog>
              )}
            </div>
          )}

          {/* KYC Required */}
          {selectedOffer?.kyc_link && (
            <div className="space-y-2">
              <Label>KYC Required</Label>
              {isStillLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <Alert
                  variant={kycFormDialogConfirmed ? "default" : "destructive"}
                >
                  {kycFormDialogConfirmed ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    Identity verification is required. Please complete the
                    lender's KYC form. You can continue while the verification
                    is in progress.
                    <br />
                    <KycDialog
                      selectedOffer={selectedOffer}
                      checked={isKycChecked}
                      onCheckedChange={setIsKycChecked}
                      onConfirm={() => setKycFormDialogConfirmed(true)}
                    />
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Moon Card Selection */}
          {selectedProduct === LoanProductOption.PayWithMoonDebitCard && (
            <div className="space-y-2">
              <Label>Choose a card</Label>
              {moonCardsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <MoonCardDropdown
                  cards={moonCards}
                  onSelect={setMoonCardId}
                  loanAmount={selectedLoanAmount}
                />
              )}
            </div>
          )}

          {/* Stablecoin Loan Address */}
          {showStablecoinLoanAddressInput && (
            <div className="space-y-2">
              <Label>Loan address</Label>
              {isStillLoading || !loanAsset ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="space-y-2">
                  <LoanAddressInputField
                    loanAddress={loanAddress ?? ""}
                    setLoanAddress={setLoanAddress}
                    hideButton={hideWalletConnectButton}
                    setHideButton={setHideWalletConnectButton}
                    loanAsset={loanAsset}
                    renderWarning={true}
                  />
                  <p className="text-muted-foreground text-xs">
                    This address will be used to transfer the loan amount
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bringin API Key Warning */}
          {bringinButNoKey && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>API Key Required</AlertTitle>
              <AlertDescription>
                You have not connected Lendasat with your Bringin account yet.
                You can do this from{" "}
                <Link
                  to="/settings/integrations"
                  className="inline-flex items-center underline"
                >
                  Settings
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={unlockWalletOrCreateOfferRequest}
            disabled={buttonDisabled}
          >
            {isCreatingRequest ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Pick Offer"
            )}
          </Button>

          {/* Error Message */}
          {createRequestError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{createRequestError}</AlertDescription>
            </Alert>
          )}

          {/* Terms of Service */}
          <ToS product={selectedProduct} />
        </CardContent>
      </Card>
    </div>
  );
};
