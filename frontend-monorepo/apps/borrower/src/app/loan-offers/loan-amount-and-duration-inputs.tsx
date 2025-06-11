import { LoanProductOption, useAuth } from "@frontend/http-client-borrower";
import type { ChangeEvent, ReactNode } from "react";
import { ReactComponent as Defi } from "../../assets/defi.svg";
import { ReactComponent as Fiat } from "../../assets/fiat.svg";
import { ReactComponent as Bringin } from "../../assets/bringin.svg";
import { ReactComponent as MoonCard } from "../../assets/moon_card_satoshi_nakamoto.svg";
import SingleDurationSelector from "./DurationSelector";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  RadioGroup,
  RadioGroupItem,
} from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Info } from "lucide-react";

interface LoanAmountAndDurationInputsProps {
  setLoanAmount: (amount: string) => void;
  loanAmount?: string;
  selectedLoanDuration?: string;
  onLoanDurationChange: (days: number) => void;
  onLoanProductSelect: (productOption: LoanProductOption) => void;
  selectedOption?: LoanProductOption;
}

interface LoanProductRadioCardItemProps {
  value: string;
  header: string;
  subHeader: string;
  img: ReactNode;
}

function LoanProductRadioCardItem({
  value,
  header,
  subHeader,
  img,
}: LoanProductRadioCardItemProps) {
  return (
    <div className="relative">
      <RadioGroupItem value={value} id={value} className="peer sr-only" />
      <Label
        htmlFor={value}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
      >
        <div className="flex flex-col items-center space-y-2">
          <span className="text-sm font-bold text-foreground shrink-0">
            {header}
          </span>
          <span className="text-xs font-light text-muted-foreground shrink-0">
            {subHeader}
          </span>
          <div className="rounded-2xl mt-2 w-[180px]">{img}</div>
        </div>
      </Label>
    </div>
  );
}

export function LoanAmountAndDurationInputs({
  setLoanAmount,
  loanAmount,
  selectedLoanDuration,
  onLoanDurationChange,
  onLoanProductSelect,
  selectedOption,
}: LoanAmountAndDurationInputsProps) {
  const { enabledFeatures } = useAuth();
  const isBringinEnabled = enabledFeatures.includes(LoanProductOption.Bringin);

  const onLoanAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setLoanAmount(e.target.value);
  };

  let disclaimer = <></>;
  switch (selectedOption) {
    case LoanProductOption.Fiat:
      disclaimer = (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>
            Most fiat loans will require KYC. Make sure to have your details
            ready.
          </AlertDescription>
        </Alert>
      );
      break;
    case LoanProductOption.StableCoins:
      disclaimer = (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>
            When borrowing against stable coins, you will receive your loan
            amount in a wallet picked by you.
          </AlertDescription>
        </Alert>
      );

      break;
    case LoanProductOption.PayWithMoonDebitCard:
      disclaimer = (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>
            A Moon Visa® Card has a spending limit of $4,000/month and a fee of
            1% per transaction.
          </AlertDescription>
        </Alert>
      );

      break;
  }

  return (
    <div className="space-y-4">
      {/* Loan Amount */}
      <div className="flex flex-col gap-1 w-full">
        <Label
          className="text-sm font-medium text-foreground"
          htmlFor="loan-amount"
        >
          How much do you wish to borrow?
        </Label>
        <div className="relative">
          <Input
            id="loan-amount"
            type="number"
            min={1}
            onChange={onLoanAmountChange}
            className="pl-8 w-full"
            value={loanAmount}
            placeholder="Enter amount"
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-muted-foreground">
            $
          </span>
        </div>
      </div>

      {/* Loan Duration */}
      <div className="flex flex-col gap-1 w-full">
        <Label
          className="text-sm font-medium text-foreground"
          htmlFor="loan-duration"
        >
          For how long do you want to borrow?
        </Label>
        <div className="w-full">
          <SingleDurationSelector
            selectedDuration={
              selectedLoanDuration
                ? Number.parseInt(selectedLoanDuration)
                : undefined
            }
            onDurationChange={onLoanDurationChange}
          />
        </div>
      </div>

      {/* Loan product */}
      <div className="flex flex-col gap-1 w-full">
        <Label
          className="text-sm font-medium text-foreground"
          htmlFor="loan-product"
        >
          How would you like to receive the loan?
        </Label>
        <div className="mx-auto">
          <RadioGroup
            value={selectedOption}
            onValueChange={(value: string) => {
              onLoanProductSelect(value as LoanProductOption);
            }}
            className={`grid gap-4 ${
              isBringinEnabled
                ? "grid-cols-1 sm:grid-cols-4"
                : "grid-cols-1 sm:grid-cols-3"
            }`}
          >
            <LoanProductRadioCardItem
              key={"stable"}
              value={LoanProductOption.StableCoins.toString()}
              header={"Stablecoins"}
              subHeader={"USDC/USDT"}
              img={<Defi width="100%" height="100%" />}
            />
            <LoanProductRadioCardItem
              key={"moon"}
              value={LoanProductOption.PayWithMoonDebitCard.toString()}
              header={"Moon Visa® Card"}
              subHeader={"A prepaid visa card"}
              img={<MoonCard width="100%" height="100%" />}
            />

            {isBringinEnabled ? (
              <LoanProductRadioCardItem
                key={"bringin"}
                value={LoanProductOption.Bringin.toString()}
                header={"Bringin"}
                subHeader={"A bank account in Euros"}
                img={<Bringin width="100%" height="100%" />}
              />
            ) : null}

            <LoanProductRadioCardItem
              key={"fiat"}
              value={LoanProductOption.Fiat.toString()}
              header={"Fiat"}
              subHeader={"EUR/USD/CHF"}
              img={<Fiat width="100%" height="100%" />}
            />
          </RadioGroup>
        </div>
        <div className={"mt-4 -mb-2"}>{disclaimer}</div>
      </div>
    </div>
  );
}
