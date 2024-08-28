import React from "react";
import { Card, Col, Container, Row } from "react-bootstrap";
import { Lender } from "../request-loan/lender";
import CurrencyFormatter from "../usd";

export function LoanHistoryComponent(props) {
  const { loan } = props;

  const { amount, lender, interest, collateral, opened, repaid } = loan;

  return (
    <Card>
      <Card.Body>
        <Container className={"p-0 m-0"} fluid>
          <Row>
            <Col md={1}>
              <CurrencyFormatter value={amount} currency="USD" locale="en-US" />
            </Col>
            <Col md={2}>
              <Lender {...lender} />
            </Col>
            <Col md={1}>{interest}%</Col>
            <Col md={2}>{collateral} BTC</Col>
            <Col></Col>
            <Col md={1}>{opened.toLocaleDateString("en-US")}</Col>
            <Col md={1}>{repaid.toLocaleDateString("en-US")}</Col>
          </Row>
        </Container>
      </Card.Body>
    </Card>
  );
}
