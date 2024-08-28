import { LoanOffer, useAuth } from "@frontend-monorepo/http-client";
import { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import LoanOffersComponent from "./loan-offers";
import LoanOffersFilter, { LoanFilter, LoanFilterType } from "./loan-offers-filter";
import { StableCoin, StableCoinHelper } from "./stable-coin";

function RequestLoan() {
  const { getLoanOffers } = useAuth();

  const [loanOffers, setLoanOffers] = useState([]);
  const [loanFilters, setLoanFilters] = useState<LoanFilter[]>([]);

  useEffect(() => {
    const fetchLoans = async () => {
      const res = await getLoanOffers() || [];

      const offers = res.map(o => (
        {
          id: o.id,
          // TODO: Do not hard-code lender profile.
          lender: {
            name: "Lord Lendalot 1",
            rate: 100,
            loans: 240,
          },
          amount: {
            min: o.loan_amount_min,
            max: o.loan_amount_max,
          },
          duration: {
            min: o.duration_months_min,
            max: o.duration_months_max,
          },
          ltv: o.min_ltv * 100,
          interest: o.interest_rate,
          coins: [StableCoinHelper.mapFromBackend(o.loan_asset_chain, o.loan_asset_type)] || [],
        }
      )).filter(offer => {
        for (const filter of loanFilters) {
          switch (filter.type) {
            case LoanFilterType.AMOUNT: {
              if (filter.value === undefined) {
                continue;
              }
              if (offer.amount.min > filter.value || offer.amount.max < filter.value) {
                return false;
              }
              break;
            }
            case LoanFilterType.STABLECOIN:
              if (filter.value === undefined || filter.value === "") {
                continue;
              }
              if (!(offer.coins.find((c) => c === filter.value))) {
                return false;
              }
              break;
            case LoanFilterType.LTV:
              if (offer.ltv > filter.value) {
                return false;
              }
              break;
            case LoanFilterType.INTEREST:
              if (offer.interest > filter.value) {
                return false;
              }
              break;
            case LoanFilterType.PERIOD:
              if (offer.duration.min > filter.value) {
                return false;
              }
              break;
          }
        }

        return true;
      });

      setLoanOffers(
        offers,
      );
    };

    fetchLoans();
  }, [loanFilters]);

  const navigate = useNavigate();
  return (
    <Container className="vh-100" fluid>
      <Row className="vh-100">
        <Col md={"2"} className="border-end d-flex align-items-stretch">
          <LoanOffersFilter
            onChange={(loanFilter: LoanFilter) => {
              // Remove any existing filter of that type.
              const filters = loanFilters.filter(
                (filter) => filter.type !== loanFilter.type,
              );
              filters.push(loanFilter);
              setLoanFilters(filters);
            }}
          />
        </Col>
        <Col md={"10"} className="p-4">
          <LoanOffersComponent
            loanOffers={loanOffers}
            onRequest={(loanOffer) => {
              navigate(`/request-loan/${loanOffer.id}`, { state: { loanOffer: loanOffer, loanFilters: loanFilters } });
            }}
          />
        </Col>
      </Row>
    </Container>
  );
}

export default RequestLoan;
