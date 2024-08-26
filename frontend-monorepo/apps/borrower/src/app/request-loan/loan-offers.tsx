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

function LoanOffersComponent({ loanOffers }: { loanOffers: LoanOffer[] }) {
  const [amountSort, setAmountSort] = useState<Sort>(Sort.NONE);
  const [durationSort, setDurationSort] = useState<Sort>(Sort.NONE);
  const [ltvSort, setLTVSort] = useState<Sort>(Sort.NONE);
  const [interestSort, setInterestSort] = useState<Sort>(Sort.NONE);

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
                icon={SortHelper.getIcon(amountSort)}
                onClick={() => setAmountSort(SortHelper.getNextSort(amountSort))}
              />
            </small>
          </Col>
          <Col md={1}>
            <small>
              Duration{" "}
              <FontAwesomeIcon
                icon={SortHelper.getIcon(durationSort)}
                onClick={() => setDurationSort(SortHelper.getNextSort(durationSort))}
              />
            </small>
          </Col>
          <Col md={1}>
            <small>
              LTV{" "}
              <FontAwesomeIcon
                icon={SortHelper.getIcon(ltvSort)}
                onClick={() => setLTVSort(SortHelper.getNextSort(ltvSort))}
              />
            </small>
          </Col>
          <Col md={1}>
            <small>
              Interest{" "}
              <FontAwesomeIcon
                icon={SortHelper.getIcon(interestSort)}
                onClick={() => setInterestSort(SortHelper.getNextSort(interestSort))}
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
        const amountComparison = SortHelper.sort(amountSort, a.amount.min, b.amount.min);
        if (amountComparison !== 0) return amountComparison;

        // Compare by duration if amount is the same
        const durationComparison = SortHelper.sort(durationSort, a.duration.min, b.duration.min);
        if (durationComparison !== 0) return durationComparison;

        // Compare by LTV if amount and duration are the same
        const ltvComparison = SortHelper.sort(ltvSort, a.ltv, b.ltv);
        if (ltvComparison !== 0) return ltvComparison;

        // Compare by interest if amount, duration, and LTV are the same
        return SortHelper.sort(interestSort, a.interest, b.interest);
      }).map((loanOffer, index) => (
        <div key={index} className={"mb-3"}>
          <LoanOfferComponent key={index} {...loanOffer} />
        </div>
      ))}
    </>
  );
}

export default LoanOffersComponent;
