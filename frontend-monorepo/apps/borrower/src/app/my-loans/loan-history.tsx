import { Contract } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Card, Col, Container, Row } from "react-bootstrap";
import { Lender } from "../request-loan/lender";

interface LoansHistoryComponentProps {
  loan: Contract;
}
export function LoanHistoryComponent(props: LoansHistoryComponentProps) {
  const { loan } = props;

  const { loan_amount, lender, interest_rate, initial_collateral_sats, created_at, repaid_at } = loan;

  const collateral_btc = initial_collateral_sats / 100000000;

  return (
    <Card>
      <Card.Body>
        <Container className={"p-0 m-0"} fluid>
          <Row>
            <Col md={1}>
              <CurrencyFormatter value={loan_amount} />
            </Col>
            <Col md={2}>
              <Lender {...lender} />
            </Col>
            <Col md={1}>{interest_rate}%</Col>
            <Col md={2}>{collateral_btc} BTC</Col>
            <Col></Col>
            <Col md={1}>{created_at.toLocaleDateString("en-US")}</Col>
            {repaid_at ? <Col md={1}>{repaid_at.toLocaleDateString("en-US")}</Col> : ""}
          </Row>
        </Container>
      </Card.Body>
    </Card>
  );
}
