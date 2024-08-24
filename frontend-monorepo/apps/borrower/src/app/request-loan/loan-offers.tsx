import { faChevronDown, faChevronUp, faMinus, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { LoanOffer, LoanOfferComponent } from "./loan-offer";

enum Sort {
  NONE = "NONE",
  ASC = "ASC",
  DESC = "DESC",
}

namespace Sort {
  export function getIcon(sort: Sort): IconDefinition {
    switch (sort) {
      case Sort.NONE:
        return faMinus;
      case Sort.ASC:
        return faChevronDown;
      case Sort.DESC:
        return faChevronUp;
    }
  }

  export function getNextSort(sort: Sort): Sort {
    switch (sort) {
      case Sort.NONE:
        return Sort.ASC;
      case Sort.ASC:
        return Sort.DESC;
      case Sort.DESC:
        return Sort.NONE;
    }
  }

  export function sort(sort: Sort, a: number, b: number): number {
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

function LoanOffersComponent({ loanOffers }: { loanOffers: LoanOffer[] }) {
  let [amountSort, setAmountSort] = useState<Sort>(Sort.NONE);
  let [durationSort, setDurationSort] = useState<Sort>(Sort.NONE);
  let [ltvSort, setLTVSort] = useState<Sort>(Sort.NONE);
  let [interestSort, setInterestSort] = useState<Sort>(Sort.NONE);

  return (
    <>
      <Container className={"mb-2"} fluid>
        <Row>
          <Col>
            <small>Lender</small>
          </Col>
          <Col md={2}>
            <small>
              Amounts{" "}
              <FontAwesomeIcon
                icon={Sort.getIcon(amountSort)}
                onClick={() => setAmountSort(Sort.getNextSort(amountSort))}
              />
            </small>
          </Col>
          <Col md={1}>
            <small>
              Duration{" "}
              <FontAwesomeIcon
                icon={Sort.getIcon(durationSort)}
                onClick={() => setDurationSort(Sort.getNextSort(durationSort))}
              />
            </small>
          </Col>
          <Col md={1}>
            <small>
              LTV <FontAwesomeIcon icon={Sort.getIcon(ltvSort)} onClick={() => setLTVSort(Sort.getNextSort(ltvSort))} />
            </small>
          </Col>
          <Col md={1}>
            <small>
              Interest{" "}
              <FontAwesomeIcon
                icon={Sort.getIcon(interestSort)}
                onClick={() => setInterestSort(Sort.getNextSort(interestSort))}
              />
            </small>
          </Col>
          <Col md={3}>
            <small>Stable coins</small>
          </Col>
          <Col md={2}></Col>
        </Row>
      </Container>
      {loanOffers.sort((a, b) => {
        // Compare by amount first
        const amountComparison = Sort.sort(amountSort, a.amount.min, b.amount.min);
        if (amountComparison !== 0) return amountComparison;

        // Compare by duration if amount is the same
        const durationComparison = Sort.sort(durationSort, a.duration.min, b.duration.min);
        if (durationComparison !== 0) return durationComparison;

        // Compare by LTV if amount and duration are the same
        const ltvComparison = Sort.sort(ltvSort, a.ltv, b.ltv);
        if (ltvComparison !== 0) return ltvComparison;

        // Compare by interest if amount, duration, and LTV are the same
        return Sort.sort(interestSort, a.interest, b.interest);
      }).map((loanOffer, index) => (
        <div key={index} className={"mb-3"}>
          <LoanOfferComponent key={index} {...loanOffer} />
        </div>
      ))}
    </>
  );
}

export default LoanOffersComponent;
