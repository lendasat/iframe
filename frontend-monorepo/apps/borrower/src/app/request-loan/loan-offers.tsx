import { faChevronDown, faChevronUp, faMinus, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanOffer } from "@frontend-monorepo/http-client-lender";
import { useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { LoanOfferComponent } from "./loan-offer";

enum Sort {
  NONE = "NONE",
  ASC = "ASC",
  DESC = "DESC",
}

class SortHelper {
  static getIcon(sort: Sort): IconDefinition {
    switch (sort) {
      case Sort.NONE:
        return faMinus;
      case Sort.ASC:
        return faChevronDown;
      case Sort.DESC:
        return faChevronUp;
    }
  }

  static getNextSort(sort: Sort): Sort {
    switch (sort) {
      case Sort.NONE:
        return Sort.ASC;
      case Sort.ASC:
        return Sort.DESC;
      case Sort.DESC:
        return Sort.NONE;
    }
  }

  static sort(sort: Sort, a: number, b: number): number {
    switch (sort) {
      case Sort.NONE:
        return 0;
      case Sort.ASC:
        return a - b;
      case Sort.DESC:
        return b - a;
    }
  }
}

interface LoanOffersComponentProps {
  loanOffers: LoanOffer[];
  onRequest: (loanOffer: LoanOffer) => void;
}

function LoanOffersComponent({ loanOffers, onRequest }: LoanOffersComponentProps) {
  const [amountSort, setAmountSort] = useState<Sort>(Sort.NONE);
  const [durationSort, setDurationSort] = useState<Sort>(Sort.NONE);
  const [ltvSort, setLTVSort] = useState<Sort>(Sort.NONE);
  const [interestSort, setInterestSort] = useState<Sort>(Sort.NONE);

  return (
    <>
      <Container className={"mb-2 bg-active-nav/30 py-1 rounded-lg"} fluid>
        <Row>
          <Col sm={5}>
            <small className="text-sm text-font font-medium">Lender</small>
          </Col>
          <Col md={2}>
            <small className="text-sm text-font font-medium">
              Amounts
            </small>
          </Col>
          <Col sm={1}>
            <small className="text-sm text-font font-medium">
              Duration
            </small>
          </Col>
          <Col md={1}>
            <small className="text-sm text-font font-medium">
              LTV
            </small>
          </Col>
          <Col md={1}>
            <small className="text-sm text-font font-medium">
              Interest
            </small>
          </Col>
          <Col md={2}>
            <small className="text-sm text-font font-medium">Stable coins</small>
          </Col>
        </Row>
      </Container>
      {loanOffers.sort((a, b) => {
        // Compare by amount first
        const amountComparison = SortHelper.sort(amountSort, a.loan_amount_max, b.loan_amount_min);
        if (amountComparison !== 0) return amountComparison;

        // Compare by duration if amount is the same
        const durationComparison = SortHelper.sort(durationSort, a.duration_months_min, b.duration_months_min);
        if (durationComparison !== 0) return durationComparison;

        // Compare by LTV if amount and duration are the same
        const ltvComparison = SortHelper.sort(ltvSort, a.min_ltv, b.min_ltv);
        if (ltvComparison !== 0) return ltvComparison;

        // Compare by interest if amount, duration, and LTV are the same
        return SortHelper.sort(interestSort, a.interest_rate, b.interest_rate);
      }).map((loanOffer, index) => (
        <div key={index} className={"mb-3"}>
          <LoanOfferComponent key={index} loanOffer={loanOffer} onRequest={onRequest} />
        </div>
      ))}
    </>
  );
}

export default LoanOffersComponent;
