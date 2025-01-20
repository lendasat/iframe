import type { MyLoanOffer } from "@frontend-monorepo/http-client-lender";
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

  const [loanOffers, setLoanOffers] = useState<MyLoanOffer[]>([]);
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

function sortOffers(offers: MyLoanOffer[], sortBy: TableSortBy): MyLoanOffer[] {
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
        n = a.duration_months_min - b.duration_months_min;
        break;
      case TableSortBy.Interest:
        n = a.interest_rate - b.interest_rate;
        break;
    }

    return n;
  });
}

export default MyLoanOffersOverview;
