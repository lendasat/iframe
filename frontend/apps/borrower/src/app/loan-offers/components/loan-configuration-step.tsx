import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@frontend/shadcn";
import { Calculator } from "lucide-react";
import { Control } from "react-hook-form";
import { LoanOffer } from "@frontend/http-client-borrower";
import {
  formatBitcoin,
  formatCurrency,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { LoanCalculation, LoanFormData } from "../loan-offer-details";
import { format } from "date-fns";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

interface LoanConfigurationStepProps {
  control: Control<LoanFormData>;
  offer: LoanOffer;
  calculation: LoanCalculation;
  monthlyInstallments?: {
    monthlyInstallments: number;
    amountPerInstallment: number;
  };
}

export const LoanConfigurationStep = ({
  control,
  offer,
  calculation,
  monthlyInstallments,
}: LoanConfigurationStepProps) => {
  const navigate = useNavigate();
  const { offerId, step } = useParams<{ offerId: string; step?: string }>();
  const [searchParams] = useSearchParams();

  const updateUrlParams = (amount?: number, duration?: number) => {
    const newParams = new URLSearchParams(searchParams);

    if (amount !== undefined && amount !== null) {
      newParams.set("amount", amount.toString());
    }

    if (duration !== undefined && duration !== null) {
      newParams.set("duration", duration.toString());
    }

    const currentStep = step || "configure";
    navigate(`/loan-offers/${offerId}/${currentStep}?${newParams.toString()}`, {
      replace: true,
    });
  };

  return (
    <div className="w-full space-y-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Configure Your Loan
          </CardTitle>
          <CardDescription>
            Set your preferred loan amount and duration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount and Duration Inputs - Side by Side */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={control}
              name="loanAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">
                    Loan Amount ({LoanAssetHelper.print(offer.loan_asset)})
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center gap-2">
                      <Input
                        type="string"
                        placeholder="Enter amount"
                        className="text-lg"
                        {...field}
                        onChange={(e) => {
                          if (
                            e.target.value.trim().length === 0 ||
                            Number.isNaN(Number(e.target.value))
                          ) {
                            field.onChange(null);
                          } else {
                            const value = Number(e.target.value);
                            field.onChange(value);
                            updateUrlParams(value, undefined);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute right-1"
                        onClick={() => {
                          field.onChange(offer.loan_amount_max);
                          updateUrlParams(offer.loan_amount_max, undefined);
                        }}
                      >
                        Max
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Range:{" "}
                    {formatCurrency(
                      offer.loan_amount_min,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}{" "}
                    -{" "}
                    {formatCurrency(
                      offer.loan_amount_max,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="loanDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">
                    Duration (Days)
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Enter duration in days"
                        className="text-lg"
                        {...field}
                        onChange={(e) => {
                          if (
                            e.target.value.trim().length === 0 ||
                            Number.isNaN(Number(e.target.value))
                          ) {
                            field.onChange(null);
                          } else {
                            const value = Number(e.target.value);
                            field.onChange(value);
                            updateUrlParams(undefined, value);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute right-1"
                        onClick={() => {
                          field.onChange(offer.duration_days_max);
                          updateUrlParams(undefined, offer.duration_days_max);
                        }}
                      >
                        Max
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Range: {offer.duration_days_min} - {offer.duration_days_max}{" "}
                    days
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Quick Calculation Preview */}
          <Card className="from-primary/5 to-primary/10 border-primary/20 bg-gradient-to-br">
            <CardContent className="pt-2">
              <div className="mb-4">
                <p className="text-muted-foreground text-md leading-relaxed">
                  You will borrow{" "}
                  <span className="text-foreground whitespace-nowrap font-semibold">
                    {formatCurrency(
                      calculation.principal,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </span>{" "}
                  at{" "}
                  <span className="text-foreground whitespace-nowrap font-semibold">
                    {(offer.interest_rate * 100).toFixed()}% p.a.
                  </span>{" "}
                  until{" "}
                  <span className="text-foreground whitespace-nowrap font-semibold">
                    {format(calculation.expiry, "MMM dd, yyyy")}
                  </span>
                  .
                </p>
              </div>
              <div className="space-y-3">
                {/* First row - Interest, Origination Fee, Total Repayment */}
                <div className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Origination Fee:
                      </span>
                      <span className="font-medium">
                        {formatCurrency(
                          calculation.originationFeeUsd,
                          LoanAssetHelper.toCurrency(offer.loan_asset),
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interest:</span>
                      <span className="font-medium">
                        {formatCurrency(
                          calculation.interest,
                          LoanAssetHelper.toCurrency(offer.loan_asset),
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Total Repayment:
                      </span>
                      <span className="text-primary font-semibold">
                        {formatCurrency(
                          calculation.total,
                          LoanAssetHelper.toCurrency(offer.loan_asset),
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Second row - Collateral Needed responsive layout */}
                <div className="flex justify-center">
                  <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
                    <span className="text-muted-foreground text-sm sm:text-base">
                      Collateral Needed:
                    </span>
                    <span className="text-primary text-sm font-semibold sm:text-base">
                      {formatBitcoin(calculation.collateralRequiredBtc)} BTC
                    </span>
                  </div>
                </div>
              </div>

              {monthlyInstallments &&
                monthlyInstallments.monthlyInstallments > 1 && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Monthly Payments:
                      </span>
                      <span className="font-medium">
                        {monthlyInstallments.monthlyInstallments} ×{" "}
                        {formatCurrency(
                          monthlyInstallments.amountPerInstallment,
                          LoanAssetHelper.toCurrency(offer.loan_asset),
                        )}
                      </span>
                    </div>
                    <div className="text-muted-foreground space-y-1 text-xs">
                      <p>• First payment due after 30 days</p>
                      <p>• A reminder will be sent a few days before</p>
                      <p>
                        • If you miss one installment, your position will get
                        liquidated
                      </p>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};
