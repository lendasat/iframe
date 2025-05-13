import { LoanProductOption, useAuth } from "@frontend/http-client-borrower";
import { Box, Flex, RadioCards, Text, TextField } from "@radix-ui/themes";
import type { ChangeEvent, ReactNode } from "react";
import { ReactComponent as Defi } from "../../assets/defi.svg";
import { ReactComponent as Fiat } from "../../assets/fiat.svg";
import { ReactComponent as Bringin } from "../../assets/bringin.svg";
import { ReactComponent as MoonCard } from "../../assets/moon_card_satoshi_nakamoto.svg";
import SingleDurationSelector from "./DurationSelector";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { InfoCircledIcon } from "@radix-ui/react-icons";

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
    <RadioCards.Item value={value}>
      <Flex direction="column">
        <Text
          size={"2"}
          weight={"bold"}
          className="text-font dark:text-font-dark shrink-0"
        >
          {header}
        </Text>
        <Text
          size={"1"}
          weight={"light"}
          className="text-font dark:text-font-dark shrink-0"
        >
          {subHeader}
        </Text>
        <Box className="rounded-2xl" mt={"2"} width={"180px"}>
          {img}
        </Box>
      </Flex>
    </RadioCards.Item>
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
          <InfoCircledIcon className="h-4 w-4" />
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
          <InfoCircledIcon className="h-4 w-4" />
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
          <InfoCircledIcon className="h-4 w-4" />
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
      <Flex direction="column" gap="1" className="w-full">
        <Text
          className="text-font dark:text-font-dark"
          as="label"
          size={"2"}
          weight={"medium"}
        >
          How much do you wish to borrow?
        </Text>
        <TextField.Root
          size={"3"}
          variant="surface"
          type="number"
          color="gray"
          min={1}
          onChange={onLoanAmountChange}
          className="text-font dark:text-font-dark w-full rounded-lg text-sm"
          value={loanAmount}
        >
          <TextField.Slot>
            <Text size={"3"} weight={"medium"}>
              $
            </Text>
          </TextField.Slot>
        </TextField.Root>
      </Flex>

      {/* Loan Duration */}
      <Flex direction="column" gap="1" className="w-full">
        <Text
          className="text-font dark:text-font-dark"
          as="label"
          size={"2"}
          weight={"medium"}
        >
          For how long do you want to borrow?
        </Text>
        <Box className="w-full">
          <SingleDurationSelector
            selectedDuration={
              selectedLoanDuration
                ? Number.parseInt(selectedLoanDuration)
                : undefined
            }
            onDurationChange={onLoanDurationChange}
          />
        </Box>
      </Flex>

      {/* Loan product */}
      <Flex direction="column" gap="1" className="w-full">
        <Text
          className="text-font dark:text-font-dark"
          as="label"
          size={"2"}
          weight={"medium"}
        >
          How would you like to receive the loan?
        </Text>
        <Box className="mx-auto">
          <RadioCards.Root
            value={selectedOption}
            columns={{ initial: "1", sm: isBringinEnabled ? "4" : "3" }}
            size={"3"}
            onValueChange={(e) => {
              onLoanProductSelect(e as LoanProductOption);
            }}
            color={"purple"}
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
          </RadioCards.Root>
        </Box>
        <div className={"mt-4 -mb-2"}>{disclaimer}</div>
      </Flex>
    </div>
  );
}
