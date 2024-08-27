import React from "react";
import { Badge, Button, Card, Col, Container, Row } from "react-bootstrap";
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
  ltv: number;
  interest: number;
  collateral: number;
  status: LoanStatus;
  lender: LenderProfile;
}

export function LoanComponent(props) {
  const { loan, onRepay } = props;

  const { amount, expiry, ltv, interest, collateral, status } = loan;

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
              <LTVProgressBar ltv={ltv} />
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
