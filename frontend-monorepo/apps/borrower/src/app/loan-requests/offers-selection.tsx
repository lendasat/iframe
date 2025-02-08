import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Callout, Heading, Text, TextField } from "@radix-ui/themes";
import { ColumnFiltersState } from "@tanstack/react-table";
import { type ChangeEvent, useState } from "react";
import { Form } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { useAsync } from "react-use";
import SingleDurationSelector from "../request-loan/steps/DurationSelector";
import { DataTableDemo } from "./offer-selection/offer-table";

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
      <Box>
        <Heading as="h3" size={"6"} className="font-semibold text-font dark:text-font-dark">
          Find a loan offer
        </Heading>
      </Box>
      <Box mt={"7"}>
        <Form className="space-y-4">
          {/* Loan Amount */}
          <Box className="space-y-1">
            <Text className="text-font/70 dark:text-font-dark/70" as="label" size={"2"} weight={"medium"}>
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
          </Box>

          {/* Loan Duration */}
          <Box className="space-y-1">
            <Text className="text-font/70 dark:text-font-dark/70" as="label" size={"2"} weight={"medium"}>
              For how long do you want to borrow?
            </Text>

            <SingleDurationSelector
              selectedDuration={selectedLoanDuration ? Number.parseInt(selectedLoanDuration) : undefined}
              onDurationChange={handleDurationChange}
              disabled={selectedProduct === undefined}
            />
          </Box>

          {loadingError
            && (
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

      <DataTableDemo
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
  );
};
