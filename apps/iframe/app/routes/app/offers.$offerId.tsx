import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { useAsync } from "react-use";
import type { Route } from "../+types/app.offers.$offerId";
import {
  apiClient,
  formatLoanAsset,
  formatCollateralAsset,
  Currency,
  getOriginationFeeForDuration,
} from "@repo/api";
import { usePriceForCurrency } from "@repo/api/price-context";
import { LoadingOverlay } from "~/components/ui/spinner";
import { Skeleton } from "~/components/ui/skeleton";
import { calculateCollateralNeeded } from "@repo/api";
import {
  useCollateralAddress,
  useLoanAssetAddress,
  useWalletInfo,
} from "~/hooks/useWallet";
import { Input } from "~/components/ui/input";
import { LoanAddressInputField } from "~/components/loan-address-input-field-shadcn";
import { Badge } from "~/components/ui/badge";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Take Offer - Lendasat" },
    { name: "description", content: "Complete your loan application" },
  ];
}

export default function TakeOffer() {
  const navigate = useNavigate();
  const { offerId } = useParams();
  const [searchParams] = useSearchParams();

  // Get wallet information from parent wallet
  const {
    publicKey,
    derivationPath,
    npub,
    loading: walletLoading,
    error: walletError,
  } = useWalletInfo();

  // Get URL parameters for pre-filled values
  const suggestedAmount = searchParams.get("amount");
  const suggestedDuration = searchParams.get("duration");

  // Get current BTC price from PriceProvider
  const btcPrice = usePriceForCurrency(Currency.USD);

  // Fetch the specific offer
  const offerState = useAsync(async () => {
    if (!offerId) return null;
    const offers = await apiClient.offers({ collateral_asset_type: "Any" });
    return offers.find((offer) => offer.id === offerId);
  }, [offerId]);

  // Get loan asset address for the offer's loan asset
  const {
    address: loanAssetAddress,
    loading: loanAssetLoading,
    error: loanAssetError,
  } = useLoanAssetAddress(offerState.value?.loanAsset);

  const collateralAsset = offerState?.value?.collateralAsset;

  const {
    address: collateralAssetAddress,
    loading: collateralAssetLoading,
    error: collateralAssetError,
    supported: collateralAssetSupported,
  } = useCollateralAddress(collateralAsset);

  // Calculate smart defaults using max values
  const defaultAmount = offerState.value
    ? offerState.value.loanAmountMax.toString()
    : "";
  const defaultDuration = offerState.value
    ? offerState.value.durationDaysMax.toString()
    : "";

  // Form state with smart defaults
  const [amount, setAmount] = useState(suggestedAmount || defaultAmount);
  const [duration, setDuration] = useState(
    suggestedDuration || defaultDuration,
  );
  const [borrowerLoanAddress, setBorrowerLoanAddress] = useState<string>("");

  // Track if defaults have been applied to avoid re-setting when user clears input
  const defaultsAppliedRef = useRef(false);
  const loanAddressPrefilledRef = useRef(false);

  // Update defaults when offer loads (only once)
  useEffect(() => {
    if (defaultsAppliedRef.current) return;

    if (
      defaultAmount &&
      defaultDuration &&
      !suggestedAmount &&
      !suggestedDuration
    ) {
      setAmount(defaultAmount);
      setDuration(defaultDuration);
      defaultsAppliedRef.current = true;
    }
  }, [defaultAmount, defaultDuration, suggestedAmount, suggestedDuration]);

  // Pre-fill loan asset address from wallet when available
  useEffect(() => {
    if (loanAssetAddress && !loanAddressPrefilledRef.current) {
      setBorrowerLoanAddress(loanAssetAddress);
      loanAddressPrefilledRef.current = true;
    }
  }, [loanAssetAddress]);

  // Calculate loan conditions
  const loanConditions = useMemo(() => {
    if (!offerState.value || !amount || !duration) return null;

    const loanAmount = parseFloat(amount);
    const durationDays = parseInt(duration);

    const offer = offerState.value;
    const currentBtcPrice = btcPrice || 0;
    const originationFee = getOriginationFeeForDuration(
      offer.originationFee,
      durationDays,
    );

    const collateralNeeded = calculateCollateralNeeded(
      loanAmount,
      offer.minLtv,
      currentBtcPrice,
      offer.interestRate,
      durationDays,
      originationFee,
    );

    // Calculate interest (simple interest for now)
    const interestRate = offer.interestRate;
    const actualInterestRate = collateralNeeded.actualInterestRate;
    const totalActualInterest = collateralNeeded.totalInterestUsd;
    const collateralValueUSD = collateralNeeded.collateralValueUsd;
    const collateralValueSats = collateralNeeded.collateralSats;
    const collateralValueBtc = collateralValueSats / 100_000_000;
    const originationFeeBTC = collateralNeeded.originationFeeSats / 100_000_000;
    const totalFundingBTC =
      collateralNeeded.totalValueToDepositSats / 100_000_000;
    const totalFundingUSD = collateralNeeded.totalValueToDepositUsd;
    const originationFeeUSD = collateralNeeded.originationFeeUsd;

    // Liquidation price (price at which LTV becomes critical)
    const liquidationPrice = currentBtcPrice * offer.minLtv;

    return {
      liquidationPrice,
      interestRatePerYear: interestRate * 100,
      actualInterestRate: actualInterestRate * 100,
      totalInterest: totalActualInterest,
      collateralBTC: collateralValueBtc,
      collateralUSD: collateralValueUSD,
      originationFeeBTC,
      originationFeeUSD,
      totalFundingBTC,
      totalFundingUSD,
      ltvPercent: offer.minLtv * 100,
    };
  }, [offerState.value, amount, duration, btcPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerId || !collateralAssetAddress || !derivationPath || !publicKey) {
      // todo: show error
      console.error(
        `Something was null - offerId: ${offerId}, address: ${collateralAssetAddress}, derivationPath: ${derivationPath}, publicKey: ${publicKey}`,
      );
      return;
    }

    if (!borrowerLoanAddress) {
      console.error("Borrower loan address is required");
      return;
    }

    try {
      const contract = await apiClient.requestContract({
        borrowerLoanAddress: borrowerLoanAddress,
        borrowerPk: publicKey,
        durationDays: Number.parseInt(duration),
        loanAmount: Number.parseFloat(amount),
        offerId: offerId,
        borrowerBtcAddress: collateralAssetAddress,
        borrowerDerivationPath: derivationPath,
        borrowerNpub: npub,
      });

      console.log("Contract requested successfully:", contract);
      navigate("/app/contracts");
    } catch (error) {
      console.error("Failed to request contract:", error);
      // TODO: Show error message to user
    }
  };

  if (!offerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-red-600">Invalid offer ID</p>
          <button
            onClick={() => navigate("/app/offers")}
            className="mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Back to Offers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/app/offers")}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Offers
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Take Offer</h1>
      </div>

      {offerState.loading && (
        <LoadingOverlay message="Loading offer details..." />
      )}

      {offerState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading offer: {offerState.error.message}
        </div>
      )}

      {offerState.value && (
        <div className="space-y-6">
          {/* Wallet Info Debug */}
          {walletLoading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
              Loading wallet information...
            </div>
          )}
          {walletError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Wallet error: {walletError}
            </div>
          )}

          {/* Loan Asset Address Status */}
          {loanAssetLoading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
              Loading {formatLoanAsset(offerState.value.loanAsset)} address...
            </div>
          )}
          {loanAssetError && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              <div className="font-semibold">
                Loan asset address not available
              </div>
              <div className="text-sm mt-1">{loanAssetError}</div>
            </div>
          )}

          {/* Collateral Asset Address Status */}
          {collateralAssetLoading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
              Loading collateral address for {collateralAsset}...
            </div>
          )}
          {collateralAssetError && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              <div className="font-semibold">
                Collateral address not available
              </div>
              <div className="text-sm mt-1">{collateralAssetError}</div>
            </div>
          )}
          {collateralAsset &&
            !collateralAssetSupported &&
            !collateralAssetLoading && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <div className="font-semibold">
                  Collateral type not supported
                </div>
                <div className="text-sm mt-1">
                  Your wallet does not support {collateralAsset} as collateral.
                </div>
              </div>
            )}

          {/* Offer Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {formatLoanAsset(offerState.value.loanAsset)} offer by{" "}
                {offerState.value.lender.name}
              </h2>
              <Badge variant="secondary">
                Collateral on{" "}
                {formatCollateralAsset(offerState.value.collateralAsset)}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Amount Range</p>
                <p className="font-medium">
                  {offerState.value.loanAmountMin} -{" "}
                  {offerState.value.loanAmountMax}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Interest Rate</p>
                <p className="font-medium">
                  {(offerState.value.interestRate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-gray-500">Duration Range</p>
                <p className="font-medium">
                  {offerState.value.durationDaysMin} -{" "}
                  {offerState.value.durationDaysMax} days
                </p>
              </div>
              <div>
                <p className="text-gray-500">Min LTV</p>
                <p className="font-medium">
                  {(offerState.value.minLtv * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {/* Application Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Loan Details
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Loan Amount *
                </label>
                <Input
                  id="amount"
                  type="number"
                  required
                  min={offerState.value.loanAmountMin}
                  max={offerState.value.loanAmountMax}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Enter amount (${offerState.value.loanAmountMin} - ${offerState.value.loanAmountMax})`}
                />
              </div>

              <div>
                <label
                  htmlFor="duration"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Duration (days) *
                </label>
                <Input
                  id="duration"
                  type="number"
                  required
                  min={offerState.value.durationDaysMin}
                  max={offerState.value.durationDaysMax}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder={`Enter duration (${offerState.value.durationDaysMin} - ${offerState.value.durationDaysMax} days)`}
                />
              </div>

              <div>
                <label
                  htmlFor="borrowerLoanAddress"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {formatLoanAsset(offerState.value.loanAsset)} Address *
                </label>
                {loanAddressPrefilledRef.current && (
                  <div className="mb-2 inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded border border-green-200">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Pre-filled by wallet
                  </div>
                )}
                <LoanAddressInputField
                  loanAddress={borrowerLoanAddress}
                  setLoanAddress={setBorrowerLoanAddress}
                  loanAsset={offerState.value.loanAsset}
                  hideButton={borrowerLoanAddress.length != 0}
                />
              </div>

              {/* Loan Conditions Summary - Always Visible */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-base font-semibold text-gray-900 mb-4">
                  Summary
                </h4>

                <div className="space-y-3 text-sm">
                  {/* Liquidation Price */}
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">Liquidation price</span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    {loanConditions ? (
                      <span className="font-medium text-gray-900">
                        ${loanConditions.liquidationPrice.toLocaleString()}
                      </span>
                    ) : (
                      <Skeleton className="h-5 w-24" />
                    )}
                  </div>

                  {/* Interest */}
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">Interest</span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    {loanConditions ? (
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {loanConditions.interestRatePerYear.toFixed(2)}%
                          <span className="text-xs text-gray-500 ml-1">
                            ({loanConditions.actualInterestRate.toFixed(1)}%
                            p.a.)
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          ≈ ${loanConditions.totalInterest.toFixed(1)} in total
                        </div>
                      </div>
                    ) : (
                      <div className="text-right space-y-1">
                        <Skeleton className="h-5 w-32 ml-auto" />
                        <Skeleton className="h-3 w-24 ml-auto" />
                      </div>
                    )}
                  </div>

                  {/* Collateral */}
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">Collateral</span>
                      {loanConditions ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                          {loanConditions.ltvPercent.toFixed(0)}% LTV
                        </span>
                      ) : (
                        <Skeleton className="h-5 w-16" />
                      )}
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    {loanConditions ? (
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {loanConditions.collateralBTC.toFixed(8)} BTC
                        </div>
                        <div className="text-xs text-gray-500">
                          ≈ ${loanConditions.collateralUSD.toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-right space-y-1">
                        <Skeleton className="h-5 w-32 ml-auto" />
                        <Skeleton className="h-3 w-24 ml-auto" />
                      </div>
                    )}
                  </div>

                  {/* Origination Fee */}
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-700">Origination fee</span>
                    {loanConditions ? (
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {loanConditions.originationFeeBTC.toFixed(8)} BTC
                        </div>
                        <div className="text-xs text-gray-500">
                          ≈ ${loanConditions.originationFeeUSD.toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-right space-y-1">
                        <Skeleton className="h-5 w-32 ml-auto" />
                        <Skeleton className="h-3 w-24 ml-auto" />
                      </div>
                    )}
                  </div>

                  {/* Total Funding Amount */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 font-medium">
                        Total funding amount
                      </span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    {loanConditions ? (
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {loanConditions.totalFundingBTC.toFixed(8)} BTC
                        </div>
                        <div className="text-xs text-gray-500">
                          ≈ ${loanConditions.totalFundingUSD.toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-right space-y-1">
                        <Skeleton className="h-5 w-32 ml-auto" />
                        <Skeleton className="h-3 w-24 ml-auto" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => navigate("/app/offers")}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  walletLoading ||
                  loanAssetLoading ||
                  collateralAssetLoading ||
                  !collateralAssetAddress ||
                  !collateralAssetSupported ||
                  !publicKey ||
                  !derivationPath
                }
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {!offerState.loading && !offerState.value && !offerState.error && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Offer not found</p>
          <button
            onClick={() => navigate("/app/offers")}
            className="mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Back to Offers
          </button>
        </div>
      )}
    </div>
  );
}
