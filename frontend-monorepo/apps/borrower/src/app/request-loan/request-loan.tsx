import type { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashHeader from "../components/DashHeader";
import OffersNav from "../components/OffersNav";
import LoanOffersComponent from "./loan-offers";
import type { LoanFilter } from "./loan-offers-filter";
import { TableSortBy } from "./loan-offers-filter";

function RequestLoan() {
  const { getLoanOffers } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const [loanOffers, setLoanOffers] = useState<LoanOffer[]>([]);
  const [loanFilter, setLoanFilter] = useState<LoanFilter>({});
  const [tableSorting, setTableSorting] = useState<TableSortBy>(TableSortBy.Amount);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLoans = async () => {
      const res = await getLoanOffers() || [];

      const offers = res.filter(offer => {
        if (loanFilter.amount) {
          if (offer.loan_amount_min > loanFilter.amount || offer.loan_amount_max < loanFilter.amount) {
            return false;
          }
        }
        if (loanFilter.stableCoin) {
          if (
            StableCoinHelper.mapFromBackend(offer.loan_asset_chain, offer.loan_asset_type) !== loanFilter.stableCoin
          ) {
            return false;
          }
        }
        if (loanFilter.ltv) {
          if (loanFilter.ltv > offer.min_ltv * 100) {
            return false;
          }
        }
        if (loanFilter.interest) {
          if (loanFilter.interest < offer.interest_rate * 100) {
            return false;
          }
        }
        if (loanFilter.period) {
          if (offer.duration_days_min > loanFilter.period) {
            return false;
          }
        }

        return true;
      });

      const sortedOffers = sortOffers(offers, tableSorting);

      setLoanOffers(sortedOffers);
      setIsLoading(false);
    };

    setIsLoading(true);
    fetchLoans();
  }, [loanFilter, getLoanOffers, tableSorting]);

  function onLoanOfferFilterChange(loanFilter: LoanFilter) {
    setLoanFilter(loanFilter);
  }

  function onTableSortingChange(tableSorting: TableSortBy) {
    setTableSorting(tableSorting);
  }

  return (
    <div>
      <DashHeader label="Loans" />
      <div className="pt-3">
        <OffersNav
          loanFilter={loanFilter}
          onLoanFilterChange={onLoanOfferFilterChange}
          tableSorting={tableSorting}
          onTableSortingChange={onTableSortingChange}
        />
        <div className="mt-3 overflow-hidden">
          <LoanOffersComponent
            loanOffers={loanOffers}
            isLoading={isLoading}
            onRequest={(loanOffer: LoanOffer) => {
              navigate(`/request-loan/${loanOffer.id}`, { state: { loanOffer: loanOffer, loanFilter: loanFilter } });
            }}
          />
        </div>
      </div>
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
