import { LoanOffer, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
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
    <Container className="vh-100" fluid>
      <Row className="vh-100">
        <Col md={"2"} className="border-end d-flex align-items-stretch">
          <LoanOffersFilter
            onChange={onLoanOfferFilterChange}
            loanFilter={loanFilter}
          />
        </Col>
        <Col md={"10"} className="p-4">
          <LoanOffersComponent
            loanOffers={loanOffers}
            onRequest={(loanOffer: LoanOffer) => {
              navigate(`/request-loan/${loanOffer.id}`, { state: { loanOffer: loanOffer, loanFilter: loanFilter } });
            }}
          />
        </Col>
      </Row>
    </Container>
  );
}

export default RequestLoan;
