import { LoanOffer } from "@frontend/http-client-borrower";
import { Alert, AlertDescription } from "@frontend/shadcn";
import { AlertTriangle } from "lucide-react";
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
        <Alert variant="destructive" className="w-full">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{loadingError.message}</AlertDescription>
        </Alert>
      )}
    </>
  );
};
