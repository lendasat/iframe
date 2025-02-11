import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { Box, Flex, RadioCards, Text, TextField } from "@radix-ui/themes";
import type { ChangeEvent, ReactNode } from "react";
import { Form } from "react-bootstrap";
import { ReactComponent as Defi } from "../../assets/defi.svg";
import { ReactComponent as MoonCard } from "../../assets/moon_card_satoshi_nakamoto.svg";
import SingleDurationSelector from "./DurationSelector";

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

function LoanProductRadioCardItem({ value, header, subHeader, img }: LoanProductRadioCardItemProps) {
  return (
    <RadioCards.Item value={value}>
      <Flex direction="column">
        <Text size={"2"} weight={"bold"} className="text-font dark:text-font-dark shrink-0">
          {header}
        </Text>
        <Text size={"1"} weight={"light"} className="text-font dark:text-font-dark shrink-0 ">
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
  const onLoanAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setLoanAmount(e.target.value);
  };

  return (
    <Form className="space-y-4">
      {/* Loan Amount */}
      <Flex direction="column" gap="1" className="w-full">
        <Text className="text-font dark:text-font-dark" as="label" size={"2"} weight={"medium"}>
          How much do you wish to borrow?
        </Text>
        <TextField.Root
          size={"3"}
          variant="surface"
          type="number"
          color="gray"
          min={1}
          onChange={onLoanAmountChange}
          className="w-full rounded-lg text-sm text-font dark:text-font-dark"
          value={loanAmount}
        >
          <TextField.Slot>
            <Text size={"3"} weight={"medium"}>$</Text>
          </TextField.Slot>
        </TextField.Root>
      </Flex>

      {/* Loan Duration */}
      <Flex direction="column" gap="1" className="w-full">
        <Text className="text-font dark:text-font-dark" as="label" size={"2"} weight={"medium"}>
          For how long do you want to borrow?
        </Text>
        <Box className="w-full">
          <SingleDurationSelector
            selectedDuration={selectedLoanDuration ? Number.parseInt(selectedLoanDuration) : undefined}
            onDurationChange={onLoanDurationChange}
            disabled={false}
          />
        </Box>
      </Flex>

      {/* Loan product */}
      <Flex direction="column" gap="1" className="w-full">
        <Text className="text-font dark:text-font-dark" as="label" size={"2"} weight={"medium"}>
          How would you like to receive the loan?
        </Text>
        <Box className="mx-auto ">
          <RadioCards.Root
            value={selectedOption}
            columns={{ initial: "1", sm: "2" }}
            size={"3"}
            onValueChange={(e) => {
              onLoanProductSelect(e as LoanProductOption);
            }}
            color={"purple"}
          >
            <LoanProductRadioCardItem
              value={LoanProductOption.StableCoins.toString()}
              header={"Stablecoins"}
              subHeader={"USDC/USDT"}
              img={<Defi width="100%" height="100%" />}
            />
            <LoanProductRadioCardItem
              value={LoanProductOption.PayWithMoonDebitCard.toString()}
              header={"Moon Visa® Card"}
              subHeader={"A prepaid visa card"}
              img={<MoonCard width="100%" height="100%" />}
            />
          </RadioCards.Root>
        </Box>
      </Flex>
    </Form>
  );
}
