import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanOffer } from "@frontend/http-client-borrower";
import { Callout } from "@radix-ui/themes";
import { ColumnFiltersState } from "@tanstack/react-table";
import { LoanOfferTable } from "./offer-table";
import { useState } from "react";

interface OffersTableProps {
  availableOffers: LoanOffer[];
  selectedOffer?: LoanOffer;
  onOfferSelect: (loanOffer?: LoanOffer) => void;
  loadingError?: Error;
  loading: boolean;
}

export const OffersSelectionTable = ({
  availableOffers,
  selectedOffer,
  onOfferSelect,
  loadingError,
  loading,
}: OffersTableProps) => {
  if (loadingError) {
    console.error(`Failed loading loan offers ${loadingError}`);
  }
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  return (
    <>
      <LoanOfferTable
        loading={loading}
        loanOffers={availableOffers}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        enableRowSelection={true}
        onOfferSelect={(id) => {
          let loanOffer = availableOffers.find((offer) => offer.id === id);
          onOfferSelect(loanOffer);
        }}
        setSelectedLoanAsset={() => {
          // TODO: can we remove this?
        }}
        selectedOfferId={selectedOffer?.id}
      />
      {loadingError && (
        <Callout.Root color="red" className="w-full">
          <Callout.Icon>
            <FontAwesomeIcon icon={faWarning} />
          </Callout.Icon>
          <Callout.Text>{loadingError.message}</Callout.Text>
        </Callout.Root>
      )}
    </>
  );
};
