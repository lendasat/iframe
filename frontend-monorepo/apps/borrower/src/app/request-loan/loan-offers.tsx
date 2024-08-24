import { Col, Container, Row } from "react-bootstrap";
import { LoanOffer, LoanOfferComponent } from "./loan-offer";

function LoanOffersComponent({ loanOffers }: { loanOffers: LoanOffer[] }) {
  return (
    <>
      <Container className={"mb-2"} fluid>
        <Row>
          <Col>
            <small>Lender</small>
          </Col>
          <Col md={2}>
            <small>Amounts</small>
          </Col>
          <Col md={1}>
            <small>Duration</small>
          </Col>
          <Col md={1}>
            <small>LTV</small>
          </Col>
          <Col md={1}>
            <small>Interest</small>
          </Col>
          <Col md={3}>
            <small>Stable coins</small>
          </Col>
          <Col md={2}></Col>
        </Row>
      </Container>
      {loanOffers.map((loanOffer, index) => (
        <div className={"mb-3"}>
          <LoanOfferComponent key={index} {...loanOffer} />
        </div>
      ))}
    </>
  );
}

export default LoanOffersComponent;
