import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { useAsync } from "react-use";
import { useEffect, useMemo } from "react";
import { usePrice } from "./price-context";
import { Skeleton } from "./components/ui/skeleton";

interface ConfigureLoanProps {
  loanAmount: number;
  lenderId: string;
  setLoanOfferId: (id: string) => void;
  days: number;
  setDays: (days: number) => void;
}

export function ConfigureLoan({
  loanAmount,
  lenderId,
  setLoanOfferId,
  days,
  setDays,
}: ConfigureLoanProps) {
  const loanAmountString = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(loanAmount);

  const { getIndirectLoanOffersByLender } = useHttpClientBorrower();
  const { latestPrice } = usePrice();

  const {
    value: loanOffers,
    error,
    loading,
  } = useAsync(async () => {
    return getIndirectLoanOffersByLender(lenderId);
  }, [lenderId]);

  const loanOffer = useMemo(() => {
    return loanOffers ? loanOffers[0] : undefined;
  }, [loanOffers]);

  useEffect(() => {
    if (loanOffer) {
      setDays(loanOffer?.duration_days_min);
    }
  }, [loanOffer]);

  useEffect(() => {
    if (loanOffer) {
      setLoanOfferId(loanOffer.id);
    }
  }, [loanOffer, setLoanOfferId]);

  const computeLoanDetails = useMemo(() => {
    if (!loanOffer) return {};

    const yearlyInterestRate = loanOffer.interest_rate;
    const collateralAmount = loanAmount / latestPrice / loanOffer.min_ltv;
    const interest = yearlyInterestRate * (days / 360) * loanAmount;
    const totalOwed = loanAmount + interest;

    return {
      yearlyInterestRate,
      yearlyInterestRateString: new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(yearlyInterestRate * 100),
      interestString: new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(interest),
      totalOwedString: new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(totalOwed),
      collateralAmountString: new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 8,
        maximumFractionDigits: 8,
      }).format(collateralAmount),
    };
  }, [loanOffer, loanAmount, latestPrice, days]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md">
        <Skeleton className="h-24 mb-4" />
        <Skeleton className="h-12 mb-4" />
        <Skeleton className="h-12 mb-4" />
        <Skeleton className="h-12 mb-4" />
      </div>
    );
  }

  if (error || !loanOffers || !loanOffer) {
    return (
      <div className="mx-auto max-w-md text-center text-red-500">
        <p>No offers available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-y-4">
      <Card className="gap-3 p-4">
        <CardHeader>
          <CardTitle>Collateral</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <div className="flex justify-between px-2">
            <Label>LTV ratio</Label>
            <Label>{loanOffer?.min_ltv}%</Label>
          </div>
          <div className="flex justify-between px-2">
            <Label>Collateral amount</Label>
            {computeLoanDetails.collateralAmountString === "NaN" ? (
              <Skeleton className="h-4 w-25" />
            ) : (
              <Label>{computeLoanDetails.collateralAmountString} BTC</Label>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="gap-3 p-4">
        <CardHeader>
          <CardTitle>Loan terms</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <Label className="px-2">Duration</Label>
          <div className="flex flex-col gap-3">
            <Label className="flex justify-center text-center text-xs">
              {days} days
            </Label>
            <Slider
              defaultValue={[days]}
              onValueChange={([x]) => {
                setDays(x);
              }}
              min={loanOffer?.duration_days_min}
              max={loanOffer?.duration_days_max}
              step={1}
              className={"w-full px-2"}
            />
          </div>
        </CardContent>
        <CardContent className="flex flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <div className="flex justify-between px-2">
            <Label>Interest rate</Label>
            <Label>{computeLoanDetails.yearlyInterestRateString}% p.a.</Label>
          </div>
        </CardContent>
        <CardContent className="flex flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <div className="flex justify-between px-2">
            <Label>Loan amount</Label>
            <Label>${loanAmountString}</Label>
          </div>
          <div className="flex justify-between px-2">
            <Label>Interest</Label>
            <Label>${computeLoanDetails.interestString}</Label>
          </div>
          <Separator className="w-1/2 border-t border-gray-600" />
          <div className="flex justify-between px-2">
            <Label>Total owed</Label>
            <Label>
              <strong>${computeLoanDetails.totalOwedString}</strong>
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
