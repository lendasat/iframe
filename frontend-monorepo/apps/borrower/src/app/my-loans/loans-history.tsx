import { Contract } from "@frontend-monorepo/http-client";
import { Col, Container, Row } from "react-bootstrap";
import { LoanHistoryComponent } from "./loan-history";

interface LoansHistoryComponentsProps {
  loan: Contract[];
}

function LoansHistoryComponent(props: LoansHistoryComponentsProps) {
  const { loans } = props;

  if (loans.length === 0) {
    return (
      <div className={"mt-4"}>
        <p>You don't have any repaid loans yet.</p>
      </div>
    );
  }

  return (
    <>
      <Container className={"mb-2 mt-4"} fluid>
        <Row>
          <Col md={1}>
            <small>Amount</small>
          </Col>
          <Col md={2}>
            <small>Lender</small>
          </Col>
          <Col md={1}>
            <small>Interest</small>
          </Col>
          <Col md={2} xs={1}>
            <small>Collateral</small>
          </Col>
          <Col>
          </Col>
          <Col md={1}>Opened</Col>
          <Col md={1}>Repaid</Col>
        </Row>
      </Container>
      {loans.map((loan, index) => (
        <div key={index} className={"mb-3"}>
          <LoanHistoryComponent key={index} loan={loan} />
        </div>
      ))}
    </>
  );
}

export default LoansHistoryComponent;
