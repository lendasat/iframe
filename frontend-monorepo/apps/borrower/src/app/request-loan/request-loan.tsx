import { LoanOffer, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import LoanOffersComponent from "./loan-offers";
import LoanOffersFilter, { LoanFilter, LoanFilterType } from "./loan-offers-filter";
import { StableCoinHelper } from "./stable-coin";

function RequestLoan() {
  const { getLoanOffers } = useBorrowerHttpClient();

  const [loanOffers, setLoanOffers] = useState<LoanOffer[]>([]);
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
            rate: 99.7,
            loans: 194,
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
              if (filter.value === undefined || filter.value === "") {
                continue;
              }
              if (offer.amount.min > Number(filter.value) || offer.amount.max < Number(filter.value)) {
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
              if (offer.ltv > Number(filter.value)) {
                return false;
              }
              break;
            case LoanFilterType.INTEREST:
              if (offer.interest > Number(filter.value)) {
                return false;
              }
              break;
            case LoanFilterType.PERIOD:
              if (offer.duration.min > Number(filter.value)) {
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
  }, [loanFilters, getLoanOffers]);

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
            onRequest={(loanOffer: LoanOffer) => {
              navigate(`/request-loan/${loanOffer.id}`, { state: { loanOffer: loanOffer, loanFilters: loanFilters } });
            }}
          />
        </Col>
      </Row>
    </Container>
  );
}

export default RequestLoan;
