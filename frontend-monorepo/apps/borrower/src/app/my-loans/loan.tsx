import { Contract, ContractStatus } from "@frontend-monorepo/http-client";
import { LtvProgressBar } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Badge, Button, Card, Col, Container, Row } from "react-bootstrap";
import { usePrice } from "../price-context";
import CurrencyFormatter from "../usd";

interface LoanComponentProps {
  loan: Contract;
  onRepay: (loan: string) => void;
}

export function LoanComponent({ loan, onRepay, onCollateralize }: LoanComponentProps) {
  const { latestPrice } = usePrice();

  const { loan_amount, expiry, interest_rate, collateral_sats, status } = loan;
  const collateral_btc = collateral_sats / 100000000;
  const ltvRatio = loan_amount / (collateral_btc * latestPrice);

  return (
    <Card>
      <Card.Body>
        <Container className={"p-0 m-0"} fluid>
          <Row>
            <Col md={1}>
              <CurrencyFormatter value={loan_amount} currency="USD" locale="en-US" />
            </Col>
            <Col md={1}>{expiry.toLocaleDateString()}</Col>
            <Col md={2}>
              <LtvProgressBar value={latestPrice ? ltvRatio : undefined} />
            </Col>
            <Col md={1}>{interest_rate}%</Col>
            <Col md={2}>{collateral_btc} BTC</Col>
            <Col md={2}>
              <Badge bg="primary">{status}</Badge>
            </Col>
            <Col className={"text-end"}>
              {(() => {
                switch (loan.status) {
                  case ContractStatus.Approved:
                    return (
                      <Button variant="primary" onClick={() => onCollateralize(loan.id)}>Collateralize Loan</Button>
                    );
                  case ContractStatus.Requested:
                  case ContractStatus.PrincipalGiven:
                  case ContractStatus.Closing:
                  case ContractStatus.Closed:
                    return <div></div>;
                  // TODO: this is the wrong state for allowing the user to repay the loan. We should only repay once the principal has been given
                  case ContractStatus.CollateralConfirmed:
                    return (
                      <>
                        <Button variant="primary">Add Collateral</Button>
                        <span>{" "}</span>
                        <Button variant="primary" onClick={() => onRepay(loan.id)}>Repay Loan</Button>
                      </>
                    );
                  case ContractStatus.Repaid:
                    return <Button variant="primary" onClick={() => onRepay(loan.id)}>Withdraw Collateral</Button>;
                }
              })()}
            </Col>
          </Row>
        </Container>
      </Card.Body>
    </Card>
  );
}
