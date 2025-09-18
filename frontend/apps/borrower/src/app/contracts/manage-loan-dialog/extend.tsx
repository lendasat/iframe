import { LuCalendarClock, LuLoader } from "react-icons/lu";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Skeleton,
  Card,
  CardContent,
  Button,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { useForm } from "react-hook-form";

interface ExtendContractProps {
  contract: Contract;
  onSubmitted: () => void;
}

interface FormData {
  extensionDays: string;
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const navigate = useNavigate();
  const { postExtendLoanRequest } = useHttpClientBorrower();
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(contract?.loan_asset),
  );

  const form = useForm<FormData>({
    defaultValues: {
      extensionDays: String(
        Math.min(contract?.extension_max_duration_days || 7, 7),
      ),
    },
  });

  const extensionDays = form.watch("extensionDays");

  // Contract values
  const currentExpiryDate = contract?.expiry;
  const loanCurrency = contract && LoanAssetHelper.toCoin(contract.loan_asset);

  // Handle extension request submission
  const handleSubmitExtension = async (data: FormData) => {
    setApiError("");
    if (!contract?.id) {
      return;
    }

    const daysNumber = Number.parseInt(data.extensionDays, 10);

    // Validate the number
    if (Number.isNaN(daysNumber) || daysNumber < 7) {
      form.setError("extensionDays", {
        type: "manual",
        message: "Minimum extension duration is 7 days",
      });
      return;
    }

    if (daysNumber > contract.extension_max_duration_days) {
      form.setError("extensionDays", {
        type: "manual",
        message: `Maximum extension duration is ${contract.extension_max_duration_days} days`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newContract = await postExtendLoanRequest(contract?.id, {
        new_duration: daysNumber,
      });
      onSubmitted();
      navigate(`/my-contracts/${newContract?.id || ""}`);
    } catch (error) {
      console.log(`Failed sending request ${error}`);
      setApiError(`Failed sending request ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedExtensionDays = parseInt(extensionDays, 10) || 0;
  const totalInterestRate = contract
    ? (contract.extension_interest_rate * parsedExtensionDays +
        contract.interest_rate * contract.duration_days) /
      (parsedExtensionDays + contract?.duration_days)
    : 0.0;

  const totalDuration = contract
    ? parsedExtensionDays + contract.duration_days
    : 0;
  const creationDate = contract?.expiry;
  const newExpiry = creationDate
    ? addDays(creationDate, parsedExtensionDays)
    : undefined;
  const actualInterestRate = totalInterestRate / (ONE_YEAR / totalDuration);
  const totalInterestUsd =
    contract && contract.loan_amount * actualInterestRate;

  const extensionFee =
    contract &&
    contract.extension_origination_fee[0].fee * contract.loan_amount;
  const extensionFeeBtc =
    extensionFee && latestPrice && extensionFee / latestPrice;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Current Expiry Date</span>
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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmitExtension)}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="extensionDays"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Extension Duration (days)</FormLabel>
                  <span className="text-muted-foreground text-sm">
                    Min: 7 days | Max: {contract.extension_max_duration_days}{" "}
                    days
                  </span>
                </div>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      // Allow empty string for deletion
                      if (inputValue === "") {
                        field.onChange("");
                        return;
                      }
                      // Only allow digits
                      if (/^\d+$/.test(inputValue)) {
                        field.onChange(inputValue);
                      }
                    }}
                    disabled={!extensionEnabled || !extensionAllowed}
                    placeholder="Enter extension days"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    <span className="text-muted-foreground text-sm">
                      In BTC
                    </span>
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
              type="submit"
              className="w-full px-0 md:w-48"
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
          {apiError && (
            <p className="text-sm font-medium text-red-500">{apiError}</p>
          )}
        </form>
      </Form>
    </div>
  );
}
