import { LoanOffer, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashHeader from "../components/DashHeader";
import OffersNav from "../components/OffersNav";
import LoanOffersComponent from "./loan-offers";
import { LoanFilter, TableSortBy } from "./loan-offers-filter";
import { StableCoinHelper } from "./stable-coin";

function RequestLoan() {
  const { getLoanOffers } = useBorrowerHttpClient();

  const [loanOffers, setLoanOffers] = useState<LoanOffer[]>([]);
  const [loanFilter, setLoanFilter] = useState<LoanFilter>({});
  const [tableSorting, setTableSorting] = useState<TableSortBy>(TableSortBy.Amount);

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
          if (offer.duration_months_min > loanFilter.period) {
            return false;
          }
        }

        return true;
      });

      const sortedOffers = sortOffers(offers, tableSorting);

      setLoanOffers(
        sortedOffers,
      );
    };

    fetchLoans();
  }, [loanFilter, getLoanOffers, tableSorting]);

  const navigate = useNavigate();

  function onLoanOfferFilterChange(loanFilter: LoanFilter) {
    setLoanFilter(loanFilter);
  }

  function onTableSortingChange(tableSorting: TableSortBy) {
    setTableSorting(tableSorting);
  }

  return (
    <div className="h-screen">
      <DashHeader label="Loans" />
      <div className="pt-3 h-full">
        <OffersNav
          loanFilter={loanFilter}
          onLoanFilterChange={onLoanOfferFilterChange}
          tableSorting={tableSorting}
          onTableSortingChange={onTableSortingChange}
        />
        <div className="h-full mt-3 overflow-hidden">
          <LoanOffersComponent
            loanOffers={loanOffers}
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
    switch (sortBy) {
      case TableSortBy.Amount:
        return a.loan_amount_min - b.loan_amount_min;

      case TableSortBy.Ltv:
        return a.min_ltv - b.min_ltv;

      case TableSortBy.Duration:
        return a.duration_months_min - b.duration_months_min;

      case TableSortBy.Interest:
        return a.interest_rate - b.interest_rate;

      case TableSortBy.Lender:
        return a.lender.name.localeCompare(b.lender.name);

      default:
        return 0;
    }
  });
}

export default RequestLoan;
