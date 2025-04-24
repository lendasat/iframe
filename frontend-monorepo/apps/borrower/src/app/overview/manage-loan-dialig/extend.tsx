import { LuCalendarClock, LuLoader } from "react-icons/lu";
import React, { useState, useMemo } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Label,
  Skeleton,
  Card,
  CardContent,
  Button,
} from "@frontend/shadcn";
import {
  Contract,
  LoanOffer,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { format, addDays } from "date-fns";
import {
  formatBitcoin,
  formatCurrency,
  LoanAssetHelper,
  ONE_YEAR,
  usePrice,
} from "@frontend/ui-shared";
import { useNavigate } from "react-router-dom";
import SingleDurationSelector, { AllowedDurations } from "./duration-selector";
import { useAsync } from "react-use";

interface ExtendContractProps {
  contract?: Contract;
}

export function ExtendContract({ contract }: ExtendContractProps) {
  const { getLoanOffersByLender } = useHttpClientBorrower();

  const [extensionDays, setExtensionDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { postExtendLoanRequest } = useHttpClientBorrower();
  const { latestPrice } = usePrice();

  const lenderIdMemorized = useMemo(() => {
    return contract?.lender.id;
  }, [contract]);

  const { error: loadingError, value } = useAsync(async () => {
    if (lenderIdMemorized) {
      return getLoanOffersByLender(lenderIdMemorized);
    }
  }, [lenderIdMemorized]);

  // Contract values
  const currentExpiryDate = contract?.expiry;
  const loanCurrency = contract && LoanAssetHelper.toCoin(contract.loan_asset);

  const maxDuration = ONE_YEAR;

  // Handle extension request submission
  const handleSubmitExtension = async (selectedOfferId?: string) => {
    console.log("handleSubmitExtension");
    setError("");
    if (!contract?.id) {
      return;
    }

    if (!selectedOfferId) {
      // TODO: set error
      console.log("2");
      return;
    }

    setIsSubmitting(true);
    console.log("Extension requested for", extensionDays, "days");
    try {
      const newContract = await postExtendLoanRequest(contract?.id, {
        loan_id: selectedOfferId,
        new_duration: extensionDays,
      });
      setIsSubmitting(false);
      navigate(`/my-contracts/${newContract?.id || ""}`);
    } catch (error) {
      console.log(`Failed sending request ${error}`);
      setError(`Failed sending request ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const unfilteredOffers = value || [];
  const offers = unfilteredOffers
    .filter((offer) => contract && offer.loan_asset === contract.loan_asset)
    .filter((offer) => {
      return (
        contract &&
        offer.loan_amount_min <= contract.loan_amount &&
        offer.loan_amount_max >= contract.loan_amount
      );
    });

  const selectedDurationDays = extensionDays || maxDuration;
  const bestOffer = findBestOffer(offers, selectedDurationDays);
  //
  const totalInterestRate =
    bestOffer && contract
      ? (bestOffer.interest_rate * selectedDurationDays +
          contract.interest_rate * contract.duration_days) /
        (selectedDurationDays + contract?.duration_days)
      : 0.0;

  const totalDuration = contract
    ? selectedDurationDays + contract.duration_days
    : 0;
  const creationDate = contract?.expiry;
  const newExpiry = creationDate
    ? addDays(creationDate, selectedDurationDays)
    : undefined;
  const actualInterestRate = totalInterestRate / (ONE_YEAR / totalDuration);
  const totalInterestUsd =
    contract && contract.loan_amount * actualInterestRate;

  const extensionFeeUsd =
    bestOffer &&
    contract &&
    bestOffer.extension_origination_fee[0].fee * contract.loan_amount;
  const extensionFeeBtc = extensionFeeUsd && extensionFeeUsd / latestPrice;

  const notAllowedDurations = populateNotAllowedDurations(offers);

  const noAvailableOffer = unfilteredOffers.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Current Expiry Date</Label>
        {currentExpiryDate ? (
          <span className="text-lg font-bold">
            {format(currentExpiryDate, "yyyy-MM-dd")}
          </span>
        ) : (
          <Skeleton className="h-4 w-[150px]" />
        )}
      </div>

      {noAvailableOffer && (
        <Alert className="my-4" variant={"destructive"}>
          <LuCalendarClock className="h-4 w-4" />
          <AlertTitle>Loan extension not available</AlertTitle>
          <AlertDescription>
            The lender has either disabled loan extensions or no suitable offer
            is available. Please reach out to the lender directly via the chat.
          </AlertDescription>
        </Alert>
      )}

      {!noAvailableOffer && (
        <Alert className="my-4">
          <LuCalendarClock className="h-4 w-4" />
          <AlertTitle>Request Extension</AlertTitle>
          <AlertDescription>
            You can request to extend your loan term. The lender will need to
            approve this request, and an extension fee may apply.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="extension-slider">Extension Duration</Label>
          </div>
          <SingleDurationSelector
            onDurationChange={(d) => setExtensionDays(d)}
            disabled={noAvailableOffer}
            selectedDuration={extensionDays}
            disabledDurations={notAllowedDurations}
          />
        </div>

        <Card className="border-muted-foreground/20">
          <CardContent className="pt-6">
            <h3 className="text-md font-semibold mb-4">Extension Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">New Expiry Date</span>
                <span className="font-medium">
                  {!noAvailableOffer && newExpiry ? (
                    format(newExpiry, "yyyy-MM-dd")
                  ) : (
                    <Skeleton className="h-4 w-[100px]" />
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-sm">Annual Interest Rate</span>
                </div>
                <span className="font-medium">
                  {!noAvailableOffer ? (
                    <span>(totalInterestRate * 100).toFixed(2){"%"})</span>
                  ) : (
                    <Skeleton className="h-4 w-[100px]" />
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Total Interest</span>
                {totalInterestUsd ? (
                  <span className="font-medium">
                    {formatCurrency(totalInterestUsd)} {loanCurrency}
                  </span>
                ) : (
                  <Skeleton className="h-4 w-[50px]" />
                )}
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-sm">Extension Fee</span>
                  </div>
                  {extensionFeeUsd ? (
                    <span className="font-medium">
                      {formatCurrency(extensionFeeUsd)} {loanCurrency}
                    </span>
                  ) : (
                    <Skeleton className="h-4 w-[50px]" />
                  )}
                </div>

                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">In BTC</span>
                  {extensionFeeBtc ? (
                    <span className="text-sm text-muted-foreground">
                      {formatBitcoin(extensionFeeBtc)} BTC
                    </span>
                  ) : (
                    <Skeleton className="h-4 w-[50px]" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pt-2">
          <Button
            type={"button"}
            className="w-full px-0"
            onClick={() => handleSubmitExtension(bestOffer?.id)}
            disabled={noAvailableOffer || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LuLoader className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Confirm Extension Request"
            )}
          </Button>
        </div>
        {(loadingError || error) && (
          <p className="text-sm font-medium text-red-500">
            {error || loadingError?.message}
          </p>
        )}
      </div>
    </div>
  );
}

const findBestOffer = (offers: LoanOffer[], days: number) => {
  const loanOffers = offers.filter(
    (offer) =>
      offer.duration_days_min <= days && offer.duration_days_max >= days,
  );
  if (loanOffers.length === 0) {
    return undefined;
  }
  return loanOffers.reduce((best, current) =>
    current.interest_rate < best.interest_rate ? current : best,
  );
};

function populateNotAllowedDurations(offers: LoanOffer[]) {
  const maxAvailableDays = Math.max(
    ...offers.map((offer) => offer.duration_days_max),
  );
  const minAvailableDays = Math.min(
    ...offers.map((offer) => offer.duration_days_min),
  );

  let notAllowedDurations: AllowedDurations[] = [];

  // Define all possible durations
  const allDurations: AllowedDurations[] = ["7d", "1m", "3m", "6m", "12m"];

  // Convert durations to days for comparison
  const durationToDays = {
    "7d": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "12m": 365,
  };

  // Check each duration if it falls outside the available range
  for (const duration of allDurations) {
    const days = durationToDays[duration];
    if (days < minAvailableDays || days > maxAvailableDays) {
      notAllowedDurations.push(duration);
    }
  }

  return notAllowedDurations;
}
