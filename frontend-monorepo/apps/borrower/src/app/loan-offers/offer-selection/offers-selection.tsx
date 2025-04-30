import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend/http-client-borrower";
import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { Box, Callout } from "@radix-ui/themes";
import { ColumnFiltersState, OnChangeFn } from "@tanstack/react-table";
import { useAsync } from "react-use";
import { LoanOfferTable } from "./offer-table";
import { LoanAsset, LoanAssetHelper } from "@frontend/ui-shared";

interface OffersTableProps {
  selectedProduct?: LoanProductOption;
  onOfferSelect: (offerId: string) => void;
  selectedOfferId?: string;
  columnFilters: ColumnFiltersState;
  setColumnFilters: OnChangeFn<ColumnFiltersState>;
}

export const OffersSelectionTable = ({
  selectedProduct,
  onOfferSelect,
  selectedOfferId,
  columnFilters,
  setColumnFilters,
}: OffersTableProps) => {
  const { getLoanOffers } = useHttpClientBorrower();

  const {
    loading,
    value: maybeAvailableOffers,
    error: loadingError,
  } = useAsync(async () => {
    return getLoanOffers();
  }, []);

  if (loadingError) {
    console.error(`Failed loading loan offers ${loadingError}`);
  }

  const unFilteredLoanOffers = maybeAvailableOffers || [];

  const loanOffers = unFilteredLoanOffers.filter((offer) => {
    let returnValue = false;
    if (selectedProduct === undefined) {
      return true;
    }
    switch (selectedProduct) {
      case LoanProductOption.Fiat:
        // only usdc on polygon can be used for pay with moon at the moment
        returnValue = LoanAssetHelper.isFiat(offer.loan_asset);
        break;

      case LoanProductOption.PayWithMoonDebitCard:
        // only usdc on polygon can be used for pay with moon at the moment
        returnValue = offer.loan_asset === LoanAsset.USDC_POL;
        break;

      case LoanProductOption.StableCoins:
        // all offers are stable coin offers at the moment - it also helps us to capture unwanted filter errors.
        if (LoanAssetHelper.isFiat(offer.loan_asset)) {
          returnValue = false;
          break;
        }
        returnValue = true;
        break;
    }
    return returnValue;
  });

  return (
    <Box>
      <Box mt={"6"}>
        <LoanOfferTable
          loading={loading}
          loanOffers={loanOffers}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          enableRowSelection={true}
          onOfferSelect={onOfferSelect}
          selectedOfferId={selectedOfferId}
        />
      </Box>
      {loadingError && (
        <Callout.Root color="red" className="w-full">
          <Callout.Icon>
            <FontAwesomeIcon icon={faWarning} />
          </Callout.Icon>
          <Callout.Text>{loadingError.message}</Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
};
