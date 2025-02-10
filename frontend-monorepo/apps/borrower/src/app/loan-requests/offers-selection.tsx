import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Callout, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { ColumnFiltersState } from "@tanstack/react-table";
import { type ChangeEvent, useState } from "react";
import { Form } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { useAsync } from "react-use";
import SingleDurationSelector from "../request-loan/steps/DurationSelector";
import { LoanOfferTable } from "./offer-selection/offer-table";

interface OffersTableProps {
  selectedProduct?: LoanProductOption;
  onOfferSelect: (offerId: string) => void;
  selectedOfferId?: string;
  selectedLoanAmount?: string;
  setLoanAmount: (value: string) => void;
  selectedLoanDuration?: string;
  setLoanDuration: (value: string) => void;
}

export const OffersSelectionTable = ({
  selectedProduct,
  onOfferSelect,
  selectedOfferId,
  selectedLoanAmount,
  setLoanAmount,
  selectedLoanDuration,
  setLoanDuration,
}: OffersTableProps) => {
  const { getLoanOffers } = useBorrowerHttpClient();
  const [_searchParams, setSearchParams] = useSearchParams();

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  function onLoanAmountChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    setColumnFilters(prev => {
      const existing = prev.filter(f => f.id !== "amount");
      return e.target.value
        ? [...existing, { id: "amount", value: e.target.value }]
        : existing;
    });

    setLoanAmount(e.target.value);
    setSearchParams(params => {
      params.set("amount", e.target.value);
      return params;
    });
  }

  // Loan Duration
  const handleDurationChange = (days: number) => {
    setLoanDuration(days.toString());
    setColumnFilters(prev => {
      const existing = prev.filter(f => f.id !== "duration");
      let value = days.toString();
      return value
        ? [...existing, { id: "duration", value: value }]
        : existing;
    });

    setSearchParams(params => {
      params.set("duration", days.toString());
      return params;
    });
  };

  const { loading, value: maybeAvailableOffers, error: loadingError } = useAsync(async () => {
    return getLoanOffers();
  }, []);

  if (loadingError) {
    console.error(`Failed loading loan offers ${loadingError}`);
  }

  const unFilteredLoanOffers = maybeAvailableOffers || [];

  const loanOffers = unFilteredLoanOffers.filter((offer) => {
    if (selectedProduct === undefined) {
      return true;
    }
    switch (selectedProduct) {
      case "pay_with_moon":
        // only usdc on polygon can be used for pay with moon at the moment
        if (offer.loan_asset_chain.toLowerCase() !== "polygon") {
          return false;
        }
        return offer.loan_asset_type.toLowerCase() === "usdc";

      case "stable_coins":
        // all offers are stable coin offers at the moment
        return true;
      case "bitrefill_debit_card":
      case "bringin_bank_account":
        return true;
    }
  });

  return (
    <Box className="p-6 md:p-8 ">
      <Box className="flex justify-center">
        {/* Use max-w-md to set a consistent maximum width for the form */}
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
              value={selectedLoanAmount}
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
                onDurationChange={handleDurationChange}
                disabled={selectedProduct === undefined}
              />
            </Box>
          </Flex>

          {loadingError && (
            <Callout.Root color="red" className="w-full">
              <Callout.Icon>
                <FontAwesomeIcon icon={faWarning} />
              </Callout.Icon>
              <Callout.Text>
                {loadingError.message}
              </Callout.Text>
            </Callout.Root>
          )}
        </Form>
      </Box>

      <Box mt={"6"}>
        <LoanOfferTable
          loading={loading}
          loanOffers={loanOffers}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          enableRowSelection={selectedProduct !== undefined && selectedLoanAmount !== undefined
            && selectedLoanDuration !== undefined}
          onOfferSelect={onOfferSelect}
          selectedOfferId={selectedOfferId}
        />
      </Box>
    </Box>
  );
};
