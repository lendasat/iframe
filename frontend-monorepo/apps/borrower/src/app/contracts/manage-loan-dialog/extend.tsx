import { LuCalendarClock, LuLoader } from "react-icons/lu";
import { useState } from "react";
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
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { format, addDays, differenceInCalendarDays, subDays } from "date-fns";
import {
  formatBitcoin,
  formatCurrency,
  LoanAssetHelper,
  ONE_YEAR,
  usePriceForCurrency,
} from "@frontend/ui-shared";
import { useNavigate } from "react-router-dom";
import SingleDurationSelector, { AllowedDurations } from "./duration-selector";

interface ExtendContractProps {
  contract: Contract;
  onSubmitted: () => void;
}

export function ExtendContract({ contract, onSubmitted }: ExtendContractProps) {
  const extensionEnabled = contract?.extension_max_duration_days !== 0;
  const days_left = differenceInCalendarDays(
    contract?.expiry || new Date(),
    new Date(),
  );
  const days_passed = contract.duration_days - days_left;

  const extensionAllowed = days_passed >= contract.duration_days / 2;
  const renewalDate = format(
    subDays(contract.expiry, contract?.duration_days / 2),
    "yyyy-MM-dd",
  );

  const [extensionDays, setExtensionDays] = useState(
    contract?.extension_max_duration_days || 7,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { postExtendLoanRequest } = useHttpClientBorrower();
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(contract?.loan_asset),
  );

  // Contract values
  const currentExpiryDate = contract?.expiry;
  const loanCurrency = contract && LoanAssetHelper.toCoin(contract.loan_asset);

  // Handle extension request submission
  const handleSubmitExtension = async () => {
    setError("");
    if (!contract?.id) {
      return;
    }

    setIsSubmitting(true);
    console.log("Extension requested for", extensionDays, "days");
    try {
      const newContract = await postExtendLoanRequest(contract?.id, {
        new_duration: extensionDays,
      });
      setIsSubmitting(false);
      onSubmitted();
      navigate(`/my-contracts/${newContract?.id || ""}`);
    } catch (error) {
      console.log(`Failed sending request ${error}`);
      setError(`Failed sending request ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalInterestRate = contract
    ? (contract.extension_interest_rate * extensionDays +
        contract.interest_rate * contract.duration_days) /
      (extensionDays + contract?.duration_days)
    : 0.0;

  const totalDuration = contract ? extensionDays + contract.duration_days : 0;
  const creationDate = contract?.expiry;
  const newExpiry = creationDate
    ? addDays(creationDate, extensionDays)
    : undefined;
  const actualInterestRate = totalInterestRate / (ONE_YEAR / totalDuration);
  const totalInterestUsd =
    contract && contract.loan_amount * actualInterestRate;

  const extensionFee =
    contract &&
    contract.extension_origination_fee[0].fee * contract.loan_amount;
  const extensionFeeBtc =
    extensionFee && latestPrice && extensionFee / latestPrice;

  const notAllowedDurations =
    contract &&
    populateNotAllowedDurations(contract.extension_max_duration_days);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Current Expiry Date</Label>
        {currentExpiryDate ? (
          <span className="text-lg font-bold">
            {format(currentExpiryDate, "yyyy-MM-dd")}
          </span>
        ) : (
          <Skeleton className="h-4 w-[150px]" />
        )}
      </div>

      {!extensionEnabled && (
        <Alert className="my-4" variant={"destructive"}>
          <LuCalendarClock className="h-4 w-4" />
          <AlertTitle>Loan extension not available</AlertTitle>
          <AlertDescription>
            The lender has disabled extensions for this contract. Please reach
            out to them directly via the chat.
          </AlertDescription>
        </Alert>
      )}

      {extensionEnabled && !extensionAllowed && (
        <Alert className="my-4" variant={"destructive"}>
          <LuCalendarClock className="h-4 w-4" />
          <AlertTitle>Loan extension not allowed yet</AlertTitle>
          <AlertDescription>
            Loan extension is only available after half of the loan's lifetime.
            I.e. after {renewalDate}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="extension-slider">Extension Duration</Label>
          </div>
          <SingleDurationSelector
            onDurationChange={(d) => setExtensionDays(d)}
            disabled={!extensionEnabled || !extensionAllowed}
            selectedDuration={extensionDays}
            disabledDurations={notAllowedDurations || allDurations}
          />
        </div>

        <Card className="border-muted-foreground/20">
          <CardContent className="pt-6">
            <h3 className="text-md mb-4 font-semibold">Extension Summary</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">New Expiry Date</span>
                <span className="font-medium">
                  {extensionEnabled && extensionAllowed && newExpiry ? (
                    format(newExpiry, "yyyy-MM-dd")
                  ) : (
                    <Skeleton className="h-4 w-[100px]" />
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-sm">Annual Interest Rate</span>
                </div>
                <span className="font-medium">
                  <span>
                    {(totalInterestRate * 100).toFixed(2)}
                    {"%"}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Total Interest</span>
                {totalInterestUsd ? (
                  <span className="font-medium">
                    {formatCurrency(
                      totalInterestUsd,
                      LoanAssetHelper.toCurrency(contract.loan_asset),
                    )}{" "}
                    {loanCurrency}
                  </span>
                ) : (
                  <Skeleton className="h-4 w-[50px]" />
                )}
              </div>

              <div className="mt-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm">Extension Fee</span>
                  </div>
                  {extensionFee !== undefined ? (
                    <span className="font-medium">
                      {formatCurrency(
                        extensionFee,
                        LoanAssetHelper.toCurrency(contract.loan_asset),
                      )}{" "}
                      {loanCurrency}
                    </span>
                  ) : (
                    <Skeleton className="h-4 w-[50px]" />
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">In BTC</span>
                  {extensionFeeBtc !== undefined ? (
                    <span className="text-muted-foreground text-sm">
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
            className="w-full px-0 md:w-48"
            onClick={handleSubmitExtension}
            disabled={!extensionEnabled || !extensionAllowed || isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <LuLoader className="h-4 w-4 animate-spin" />
                <span>Please wait</span>
              </div>
            ) : (
              <span>Confirm Extension Request</span>
            )}
          </Button>
        </div>
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      </div>
    </div>
  );
}

const allDurations: AllowedDurations[] = ["7d", "1m", "3m", "6m", "12m"];

function populateNotAllowedDurations(extension_max_duration_days: number) {
  const maxAvailableDays = extension_max_duration_days;
  const minAvailableDays = 7;

  let notAllowedDurations: AllowedDurations[] = [];

  // Convert durations to days for comparison
  const durationToDays = {
    "7d": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "12m": ONE_YEAR,
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
