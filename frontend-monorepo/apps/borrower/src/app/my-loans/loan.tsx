import React from "react";
import { Badge, Button, Card, Col, Container, Row } from "react-bootstrap";
import { usePrice } from "../price-context";
import { LenderProfile } from "../request-loan/lender";
import CurrencyFormatter from "../usd";
import LTVProgressBar from "./ltv-progress-bar";

export enum LoanStatus {
  REQUESTED = "REQUESTED",
  OPEN = "OPEN",
  CLOSING = "CLOSING",
  CLOSED = "CLOSED",
}

export interface Loan {
  id: string;
  amount: number;
  opened: Date;
  repaid: Date;
  expiry: Date;
  interest: number;
  collateral: number;
  status: LoanStatus;
  lender: LenderProfile;
}

export function LoanComponent(props) {
  const { loan, onRepay } = props;
  const { latestPrice } = usePrice();

  const { amount, expiry, interest, collateral, status } = loan;

  // reversing the current ltv ratio to better illustrate the health of the ltv. A lower number means that the health is
  // bad, while a higher number means the ltv is good. The ltv ratio would work the other way around as a higher ltv ratio
  // means the collateral is moving closer to the actual loan principal.
  const reversedCurrentLTV = ((1 - (amount / (collateral * latestPrice))) * 100).toFixed(2);

  return (
    <Card>
      <Card.Body>
        <Container className={"p-0 m-0"} fluid>
          <Row>
            <Col md={1}>
              <CurrencyFormatter value={amount} currency="USD" locale="en-US" />
            </Col>
            <Col md={1}>{expiry.toLocaleDateString("en-US")}</Col>
            <Col md={2}>
              <LTVProgressBar ltv={reversedCurrentLTV} />
            </Col>
            <Col md={1}>{interest}%</Col>
            <Col md={2}>{collateral} BTC</Col>
            <Col md={2}>
              <Badge bg="primary">{status}</Badge>
            </Col>
            <Col className={"text-end"}>
              {loan.status === LoanStatus.OPEN && (
                <>
                  <Button variant="primary">Add Collateral</Button>
                  <span>{" "}</span>
                  <Button variant="primary" onClick={() => onRepay(loan)}>Repay Loan</Button>
                </>
              )}
            </Col>
          </Row>
        </Container>
      </Card.Body>
    </Card>
  );
}
