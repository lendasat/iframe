import { LoanOffer, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashHeader from "../components/DashHeader";
import OffersNav from "../components/OffersNav";
import LoanOffersComponent from "./loan-offers";
import LoanOffersFilter, { LoanFilter } from "./loan-offers-filter";
import { StableCoinHelper } from "./stable-coin";

function RequestLoan() {
  const { getLoanOffers } = useBorrowerHttpClient();

  const [loanOffers, setLoanOffers] = useState<LoanOffer[]>([]);
  const [loanFilter, setLoanFilter] = useState<LoanFilter>({});

  useEffect(() => {
    const fetchLoans = async () => {
      const res = await getLoanOffers() || [];

      const offers = res.filter(offer => {
        if (loanFilter.amount) {
          console.log(`Loan filter amount ${loanFilter.amount}`);
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

      setLoanOffers(
        offers,
      );
    };

    fetchLoans();
  }, [loanFilter, getLoanOffers]);

  const navigate = useNavigate();

  function onLoanOfferFilterChange(loanFilter: LoanFilter) {
    setLoanFilter(loanFilter);
  }

  return (
    <div className="h-screen pb-48">
      <DashHeader label="Loans" />
      <div className="pt-3 h-full">
        <OffersNav
          loanFilter={loanFilter}
          onChange={onLoanOfferFilterChange}
        />
        <div className="h-full mt-3 py-2 rounded-xl overflow-y-scroll">
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

export default RequestLoan;
