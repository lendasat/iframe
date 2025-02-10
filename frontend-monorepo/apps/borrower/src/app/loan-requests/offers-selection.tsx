import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Callout } from "@radix-ui/themes";
import { ColumnFiltersState, OnChangeFn } from "@tanstack/react-table";
import { useAsync } from "react-use";
import { LoanOfferTable } from "./offer-selection/offer-table";

interface OffersTableProps {
  selectedProduct?: LoanProductOption;
  onOfferSelect: (offerId: string) => void;
  selectedOfferId?: string;
  selectedLoanAmount?: string;
  selectedLoanDuration?: string;
  columnFilters: ColumnFiltersState;
  setColumnFilters: OnChangeFn<ColumnFiltersState>;
}

export const OffersSelectionTable = ({
  selectedProduct,
  onOfferSelect,
  selectedOfferId,
  selectedLoanAmount,
  selectedLoanDuration,
  columnFilters,
  setColumnFilters,
}: OffersTableProps) => {
  const { getLoanOffers } = useBorrowerHttpClient();

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
    </Box>
  );
};
