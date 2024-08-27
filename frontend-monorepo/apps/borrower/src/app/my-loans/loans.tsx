import { Col, Container, Row } from "react-bootstrap";
import { LoanComponent } from "./loan";

function LoansComponent(props) {
  const { loans, onRepay } = props;

  if (loans.length === 0) {
    return <p>You don't have any loans yet.</p>;
  }

  return (
    <>
      <Container className={"mb-2"} fluid>
        <Row>
          <Col md={1}>
            <small>Amount</small>
          </Col>
          <Col md={1}>
            <small>Expiry</small>
          </Col>
          <Col md={2}>
            <small>LTV Health</small>
          </Col>
          <Col md={1}>
            <small>Interest</small>
          </Col>
          <Col md={2} xs={1}>
            <small>Collateral</small>
          </Col>
          <Col md={1}>
            <small>Status</small>
          </Col>
          <Col></Col>
        </Row>
      </Container>
      {loans.map((loan, index) => (
        <div key={index} className={"mb-3"}>
          <LoanComponent key={index} loan={loan} onRepay={onRepay} />
        </div>
      ))}
    </>
  );
}

export default LoansComponent;
