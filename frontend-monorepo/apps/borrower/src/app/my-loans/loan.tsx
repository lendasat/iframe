import { LtvProgressBar } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Badge, Button, Card, Col, Container, Row } from "react-bootstrap";
import { usePrice } from "../price-context";
import { LenderProfile } from "../request-loan/lender";
import CurrencyFormatter from "../usd";

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

interface LoanComponentProps {
  loan: Loan;
  onRepay: (loan: string) => void;
}

export function LoanComponent({ loan, onRepay }: LoanComponentProps) {
  const { latestPrice } = usePrice();

  const { amount, expiry, interest, collateral, status } = loan;

  const ltvRatio = (amount / (collateral * latestPrice)) * 100;

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
              <LtvProgressBar value={ltvRatio} />
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
                  <Button variant="primary" onClick={() => onRepay(loan.id)}>Repay Loan</Button>
                </>
              )}
            </Col>
          </Row>
        </Container>
      </Card.Body>
    </Card>
  );
}
