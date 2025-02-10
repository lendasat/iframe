import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { Box, Flex, RadioCards, Text, TextField } from "@radix-ui/themes";
import type { ChangeEvent } from "react";
import { Form } from "react-bootstrap";
import SingleDurationSelector from "../request-loan/steps/DurationSelector";

interface LoanAmountAndDurationInputsProps {
  selectedProduct?: LoanProductOption;
  setLoanAmount: (amount: string) => void;
  loanAmount?: string;
  selectedLoanDuration?: string;
  onLoanDurationChange: (days: number) => void;
  onLoanProductSelect: (productOption: LoanProductOption) => void;
  selectedOption?: LoanProductOption;
}

export function LoanAmountAndDurationInputs({
  selectedProduct,
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
    <Form className="space-y-4 max-w-md">
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
          disabled={selectedProduct === undefined}
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
            disabled={selectedProduct === undefined}
          />
        </Box>
      </Flex>

      {/* Loan product */}
      <Flex direction="column" gap="1" className="w-full">
        <Text className="text-font dark:text-font-dark" as="label" size={"2"} weight={"medium"}>
          How would you like to receive the loan?
        </Text>
        <Box className="w-full">
          <RadioCards.Root
            value={selectedOption}
            columns={{ initial: "1", sm: "2" }}
            onValueChange={(e) => {
              onLoanProductSelect(e as LoanProductOption);
            }}
          >
            <RadioCards.Item value={LoanProductOption.StableCoins.toString()}>
              <Flex direction="column" width="100%">
                <Text weight="bold">Stablecoins</Text>
                <Text>USDC/USDT</Text>
              </Flex>
            </RadioCards.Item>
            <RadioCards.Item value={LoanProductOption.PayWithMoonDebitCard.toString()}>
              <Flex direction="column" width="100%">
                <Text weight="bold">Moon Visa® Card</Text>
                <Text>A prepaid visa card</Text>
              </Flex>
            </RadioCards.Item>
          </RadioCards.Root>
        </Box>
      </Flex>
    </Form>
  );
}
