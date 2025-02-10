import type { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box } from "@radix-ui/themes";
import { useAsync } from "react-use";
import DashHeader from "../components/DashHeader";
import { LoanOfferTable } from "../loan-requests/offer-selection/offer-table";
import { TableSortBy } from "./loan-offers-filter";

function RequestLoan() {
  const { getLoanOffers } = useBorrowerHttpClient();

  const { loading, value } = useAsync(async () => {
    return await getLoanOffers();
  });

  const loanOffers = value || [];

  return (
    <div>
      <DashHeader label="Available Offers" />
      {/*TODO: re-implement filters if needed */}
      <Box className="pt-3" px={"6"}>
        <LoanOfferTable
          loading={loading}
          loanOffers={loanOffers}
          columnFilters={[]}
          onColumnFiltersChange={() => {}}
          enableRowSelection={false}
          onOfferSelect={undefined}
          selectedOfferId={undefined}
        />
      </Box>
    </div>
  );
}

function sortOffers(offers: LoanOffer[], sortBy: TableSortBy): LoanOffer[] {
  return offers.sort((a, b) => {
    let n;
    switch (sortBy) {
      case TableSortBy.Amount:
        n = a.loan_amount_min - b.loan_amount_min;
        break;
      case TableSortBy.Ltv:
        n = a.min_ltv - b.min_ltv;
        break;
      case TableSortBy.Duration:
        n = a.duration_days_min - b.duration_days_min;
        break;
      case TableSortBy.Interest:
        n = a.interest_rate - b.interest_rate;
        break;
      case TableSortBy.Lender:
        n = a.lender.name.localeCompare(b.lender.name);
        break;
    }

    return n;
  });
}

export default RequestLoan;
