import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Separator } from "@/components/ui/separator.tsx";

export function ConfigureLoan() {
  const [months, setMonths] = useState(4);

  // TODO: Should come from button presser.
  const loanAmount = 5000;
  const loanAmountString = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(loanAmount);

  const yearlyInterestRate = 9.5 + months * 0.25;
  const yearlyInterestRateString = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(yearlyInterestRate);

  const interest = (yearlyInterestRate / 100) * (months / 12) * loanAmount;
  const interestString = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(interest);

  const totalOwed = loanAmount + interest;
  const totalOwedString = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalOwed);

  return (
    <div className="flex flex-col items-center gap-2">
      <Card className="w-[350px] gap-3 p-4">
        <CardHeader>
          <CardTitle>Collateral</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <div className="flex justify-between px-2">
            <Label>LTV ratio</Label>
            <Label>50%</Label>
          </div>
          <div className="flex justify-between px-2">
            <Label>Collateral amount</Label>
            <Label>₿ 0.13 370 000</Label>
          </div>
          <Label className="justify-center"></Label>
        </CardContent>
      </Card>
      <Card className="w-[350px] gap-3 p-4">
        <CardHeader>
          <CardTitle>Loan terms</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <Label className="px-2">Duration</Label>
          <div className="flex flex-col gap-3">
            <Label className="flex justify-center text-center text-xs">
              {months} months
            </Label>
            <Slider
              defaultValue={[months]}
              onValueChange={([x]) => {
                setMonths(x);
              }}
              min={1}
              max={12}
              step={1}
              className={"w-full px-2"}
            />
          </div>
        </CardContent>
        <CardContent className="flex flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <div className="flex justify-between px-2">
            <Label>Interest rate</Label>
            <Label>{yearlyInterestRateString}% p.a.</Label>
          </div>
          <Label className="text-xs">
            <em>
              This rate is fixed based on your selected duration and current
              market conditions.
            </em>
          </Label>
        </CardContent>
        <CardContent className="flex flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-gray-300">
          <div className="flex justify-between px-2">
            <Label>Loan amount</Label>
            <Label>${loanAmountString}</Label>
          </div>
          <div className="flex justify-between px-2">
            <Label>Interest</Label>
            <Label>${interestString}</Label>
          </div>
          <Separator className="w-1/2 border-t border-gray-600" />
          <div className="flex justify-between px-2">
            <Label>Total owed</Label>
            <Label>
              <strong>${totalOwedString}</strong>
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
