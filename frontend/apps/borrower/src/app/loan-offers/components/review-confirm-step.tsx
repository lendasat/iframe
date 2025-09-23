import { Control } from "react-hook-form";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Separator,
} from "@frontend/shadcn";
import { ChevronRight, FileCheck, Shield } from "lucide-react";
import { LoanOffer, LoanProductOption } from "@frontend/http-client-borrower";
import { formatCurrency, LoanAssetHelper } from "@frontend/ui-shared";
import { ToS } from "../tos";
import { LoanProductTypes } from "../loan-request-flow";
import { LoanFormData } from "../loan-offer-details";
import { add, format } from "date-fns";

interface ReviewConfirmStepProps {
  control: Control<LoanFormData>;
  offer: LoanOffer;
  paymentType: LoanProductTypes;
  watchLoanAmount: number;
  watchLoanDuration: number;
  calculation: {
    principal: number;
    interest: number;
    total: number;
    originationFeeUsd: number;
    originationFeeBtc: number;
    collateralRequiredUsd: number;
    collateralRequiredBtc: number;
    apr: number;
    ltv: number;
  };
  monthlyInstallments?: {
    monthlyInstallments: number;
    amountPerInstallment: number;
  };
  isCreatingRequest: boolean;
  confirmLoanTerms: boolean;
}

export const ReviewConfirmStep = ({
  control,
  offer,
  paymentType,
  watchLoanAmount,
  watchLoanDuration,
  calculation,
  monthlyInstallments,
  isCreatingRequest,
  confirmLoanTerms,
}: ReviewConfirmStepProps) => {
  // Helper function to calculate loan expiry date
  const getLoanExpiryDate = (durationDays: number) => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);
    return expiryDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Helper function to get first monthly payment date
  const getFirstPaymentDate = () => {
    const firstPayment = new Date();
    firstPayment.setMonth(firstPayment.getMonth() + 1);
    return firstPayment.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Helper function to get final payment date for monthly payments
  const getFinalPaymentDate = (durationDays: number) => {
    const finalDate = add(new Date(), { days: durationDays });
    return format(finalDate, "MMM, dd yyyy - p");
  };

  return (
    <div className="w-full space-y-8">
      {/* Loan Summary */}
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Loan Summary
          </CardTitle>
          <CardDescription>
            Review your loan details before submitting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Left Column - Loan Details */}
            <div className="space-y-4">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                Loan Details
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {formatCurrency(
                      watchLoanAmount,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{watchLoanDuration} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest Rate</span>
                  <span className="font-medium">
                    {calculation.apr.toFixed(1)}% APR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LTV Ratio</span>
                  <span className="font-medium">
                    {calculation.ltv.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Financial Breakdown */}
            <div className="space-y-4">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                Payment Breakdown
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-medium">
                    {formatCurrency(
                      calculation.principal,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest</span>
                  <span className="font-medium">
                    {formatCurrency(
                      calculation.interest,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origination Fee</span>
                  <span className="font-medium">
                    ${calculation.originationFeeUsd.toFixed(2)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Repayment</span>
                  <span className="text-primary">
                    {formatCurrency(
                      calculation.total,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Installments */}
          {monthlyInstallments &&
            monthlyInstallments.monthlyInstallments > 1 && (
              <div className="bg-muted/30 mt-6 rounded-lg p-4">
                <h4 className="mb-2 font-medium">Payment Schedule</h4>
                <div className="text-muted-foreground text-sm">
                  {monthlyInstallments.monthlyInstallments} monthly interest
                  payments of{" "}
                  <span className="text-foreground font-medium">
                    {formatCurrency(
                      monthlyInstallments.amountPerInstallment,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 text-sm">
                  From {getFirstPaymentDate()} until{" "}
                  {getFinalPaymentDate(watchLoanDuration)}
                </div>
              </div>
            )}

          {/* Collateral Required */}
          <div className="mt-6 rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Collateral Required</h4>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {calculation.collateralRequiredBtc.toFixed(8)} BTC
              </p>
              <p className="text-muted-foreground text-sm">
                ≈{" "}
                {formatCurrency(
                  calculation.collateralRequiredUsd,
                  LoanAssetHelper.toCurrency(offer.loan_asset),
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan Agreement */}
      <Card className="border-primary/30 from-primary/5 to-primary/10 border-2 bg-gradient-to-br shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Loan Agreement
          </CardTitle>
          <CardDescription>
            Please review and accept the terms to proceed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="confirmLoanTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-1"
                  />
                </FormControl>
                <div className="space-y-3 leading-none">
                  <FormLabel className="cursor-pointer text-sm font-medium leading-relaxed">
                    <div className="space-y-2">
                      <div>
                        I agree to take a loan of{" "}
                        <span className="whitespace-nowrap font-semibold">
                          {formatCurrency(
                            watchLoanAmount,
                            LoanAssetHelper.toCurrency(offer.loan_asset),
                          )}
                        </span>{" "}
                        for{" "}
                        <span className="whitespace-nowrap font-semibold">
                          {watchLoanDuration} days
                        </span>
                        {monthlyInstallments &&
                        monthlyInstallments.monthlyInstallments > 1 ? (
                          <>
                            {" "}
                            with monthly interest payments of{" "}
                            <span className="whitespace-nowrap font-semibold">
                              {formatCurrency(
                                monthlyInstallments.amountPerInstallment,
                                LoanAssetHelper.toCurrency(offer.loan_asset),
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            {" "}
                            with a total repayment of{" "}
                            <span className="whitespace-nowrap font-semibold">
                              {formatCurrency(
                                calculation.total,
                                LoanAssetHelper.toCurrency(offer.loan_asset),
                              )}
                            </span>
                          </>
                        )}
                        .
                      </div>
                      {monthlyInstallments &&
                        monthlyInstallments.monthlyInstallments > 1 && (
                          <div className="text-muted-foreground text-xs">
                            Payments from{" "}
                            <span className="whitespace-nowrap">
                              {getFirstPaymentDate()}
                            </span>{" "}
                            until{" "}
                            <span className="whitespace-nowrap">
                              {getFinalPaymentDate(watchLoanDuration)}
                            </span>
                          </div>
                        )}
                      {!(
                        monthlyInstallments &&
                        monthlyInstallments.monthlyInstallments > 1
                      ) && (
                        <div className="text-muted-foreground text-xs">
                          Due on{" "}
                          <span className="whitespace-nowrap">
                            {getLoanExpiryDate(watchLoanDuration)}
                          </span>
                        </div>
                      )}
                    </div>
                  </FormLabel>
                  <ToS
                    product={
                      paymentType === LoanProductTypes.PayWithMoon
                        ? LoanProductOption.PayWithMoonDebitCard
                        : undefined
                    }
                  />
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-center pt-6">
        <Button
          type="submit"
          size="lg"
          className="h-12 min-w-64 text-lg font-medium"
          disabled={isCreatingRequest || !confirmLoanTerms}
        >
          {isCreatingRequest ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
              Processing...
            </>
          ) : (
            "Accept Loan Offer"
          )}
          {!isCreatingRequest && <ChevronRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
