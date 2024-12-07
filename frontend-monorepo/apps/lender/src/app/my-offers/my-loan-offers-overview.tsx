import type { LoanOffer } from "@frontend-monorepo/http-client-lender";
import { useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { Box, Heading } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import MyLoanOffersComponent from "./my-loan-offers";

export enum TableSortBy {
  Amount = "Amount",
  Duration = "Duration",
  Ltv = "Ltv",
  Interest = "Interest",
}

function MyLoanOffersOverview() {
  const { getMyLoanOffers } = useLenderHttpClient();

  const [loanOffers, setLoanOffers] = useState<LoanOffer[]>([]);
  const tableSorting = TableSortBy.Amount;

  useEffect(() => {
    const fetchLoans = async () => {
      const offers = (await getMyLoanOffers()) || [];

      const sortedOffers = sortOffers(offers, tableSorting);

      setLoanOffers(sortedOffers);
    };
    fetchLoans();
  }, [getMyLoanOffers, tableSorting]);

  const { innerHeight } = window;

  return (
    <Box
      style={{
        height: innerHeight - 130,
      }}
    >
      <Box className="p-6 md:p-8">
        <Heading className={"text-font dark:text-font-dark"} size={"7"}>My Proposals</Heading>
      </Box>
      <MyLoanOffersComponent loanOffers={loanOffers} />
    </Box>
  );
}

function sortOffers(offers: LoanOffer[], sortBy: TableSortBy): LoanOffer[] {
  return offers.sort((a, b) => {
    switch (sortBy) {
      case TableSortBy.Amount:
        return a.loan_amount_min - b.loan_amount_min;

      case TableSortBy.Ltv:
        return a.min_ltv - b.min_ltv;

      case TableSortBy.Duration:
        return a.duration_months_min - b.duration_months_min;

      case TableSortBy.Interest:
        return a.interest_rate - b.interest_rate;

      default:
        return 0;
    }
  });
}

export default MyLoanOffersOverview;
