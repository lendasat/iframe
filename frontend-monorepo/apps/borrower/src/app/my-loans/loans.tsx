import { Contract, contractStatusToLabelString, LiquidationStatus } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter, LtvProgressBar, usePrice } from "@frontend-monorepo/ui-shared";
import { Badge, Button, Card, Col, Container, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { collateralForStatus } from "./collateralForStatus";

interface LoansComponentProps {
  loans: Contract[];
}

function ContractsComponent({ loans }: LoansComponentProps) {
  const { latestPrice } = usePrice();
  const navigate = useNavigate();

  if (loans.length === 0) {
    return <p>You don't have any loans yet.</p>;
  }

  const amount_col = {
    label: "Amount",
    md: 1,
    className: "text-center",
  };

  const expiry_col = {
    label: "Expiry",
    md: 2,
    className: "text-center",
  };

  const ltv_col = {
    label: "LTV",
    md: 2,
    className: "text-center",
  };
  const interest_col = {
    label: "Interest",
    md: 1,
    className: "text-center",
  };
  const collateral_col = {
    label: "Collateral",
    md: 2,
    className: "text-center",
  };
  const status_col = {
    label: "Status",
    md: 2,
    className: "",
  };
  const empty_col = {
    label: "",
    md: 2,
    className: "text-center",
  };

  const headers = [amount_col, expiry_col, ltv_col, interest_col, collateral_col, status_col, empty_col];

  return (
    <Container fluid>
      <Row className="d-none d-md-flex mb-3">
        {headers.map((header, index) => (
          <Col key={index} md={header.md} className={header.className}>
            <small className="text-muted">{header.label}</small>
          </Col>
        ))}
      </Row>
      {loans.map((loan, index) => {
        const {
          id,
          loan_amount,
          expiry,
          interest_rate,
          initial_collateral_sats,
          status,
          liquidation_status,
          collateral_sats,
        } = loan;

        const collateral_btc = collateralForStatus(status, initial_collateral_sats, collateral_sats) / 100000000;

        const ltvRatio = loan_amount / (collateral_btc * latestPrice);

        const firstMarginCall = liquidation_status == LiquidationStatus.FirstMarginCall;
        const secondMarginCall = liquidation_status == LiquidationStatus.SecondMarginCall;
        const liquidated = liquidation_status == LiquidationStatus.Liquidated;

        let contractStatusLabel = contractStatusToLabelString(status);
        if (firstMarginCall) {
          contractStatusLabel = "First Margin Call";
        }
        if (secondMarginCall) {
          contractStatusLabel = "Second Margin Call";
        }
        if (liquidated) {
          contractStatusLabel = "Liquidated";
        }

        return (
          <Card key={index} className="mb-3">
            <Card.Body>
              <Row className="align-items-center">
                <Col xs={12} md={amount_col.md} className="mb-2 mb-md-0">
                  <div className="d-md-none">Amount:</div>
                  <CurrencyFormatter value={loan_amount} />
                </Col>
                <Col xs={12} md={expiry_col.md} className="mb-2 mb-md-0">
                  <div className="d-md-none font-weight-bold">Expiry:</div>
                  {expiry.toLocaleDateString()}
                </Col>
                <Col xs={12} md={ltv_col.md} className="mb-2 mb-md-0">
                  <div className="d-md-none font-weight-bold">LTV:</div>
                  <LtvProgressBar ltvRatio={latestPrice ? ltvRatio * 100 : undefined} />
                </Col>
                <Col xs={12} md={interest_col.md} className="mb-2 mb-md-0">
                  <div className="d-md-none font-weight-bold">Interest:</div>
                  {interest_rate * 100}%
                </Col>
                <Col xs={12} md={collateral_col.md} className="mb-2 mb-md-0">
                  <div className="d-md-none font-weight-bold">Collateral:</div>
                  {collateral_btc} BTC
                </Col>
                <Col xs={12} md={status_col.md} className="mb-2 mb-md-0">
                  <div className="d-md-none font-weight-bold">Status:</div>
                  <Badge bg="primary">{contractStatusLabel}</Badge>
                </Col>
                <Col xs={12} md={empty_col.md} className="mb-2 mb-md-0">
                  <Button onClick={() => navigate(`${id}`)} variant={"primary"}>Details</Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        );
      })}
    </Container>
  );
}

export default ContractsComponent;
