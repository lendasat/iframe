import {
  LoanProductOption,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { ScrollArea } from "@frontend/shadcn";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import DashHeader from "../components/DashHeader";
import { LoanOfferTable } from "./offer-selection/offer-table";
import { LoanAssetHelper } from "@frontend/ui-shared";

function AvailableOffers() {
  const { getDirectLoanOffers } = useHttpClientBorrower();
  const navigate = useNavigate();

  const { loading, value } = useAsync(async () => {
    return await getDirectLoanOffers();
  });

  const filteredLoanOffers = value || [];

  return (
    <ScrollArea className="h-screen">
      <DashHeader label="Available Offers" />
      {/*TODO: re-implement filters if needed */}
      <div className="px-6 pb-8 pt-3">
        <LoanOfferTable
          loading={loading}
          loanOffers={filteredLoanOffers}
          columnFilters={[]}
          onColumnFiltersChange={() => {
            // ignored
          }}
          enableRowSelection={false}
          onOfferSelect={() => {
            // ignored
          }}
          selectedOfferId={undefined}
          enableActionColumn={true}
          onActionColumnAction={(value) => {
            let product = LoanProductOption.StableCoins;
            if (LoanAssetHelper.isFiat(value.loan_asset)) {
              product = LoanProductOption.Fiat;
            }
            navigate(
              `/loan-offers/${value.id}?amount=${value.loan_amount_min}&duration=${value.duration_days_min}&paymentType=${product}`,
            );
          }}
        />
      </div>
    </ScrollArea>
  );
}

export default AvailableOffers;
