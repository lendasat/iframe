import { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Badge, Button, Card, Col, Container, Row } from "react-bootstrap";
import { Lender } from "./lender";
import { StableCoinHelper } from "./stable-coin";

interface LoanOfferProps {
  loanOffer: LoanOffer;
  onRequest: (loanOffer: LoanOffer) => void;
}

export function LoanOfferComponent({ loanOffer, onRequest }: LoanOfferProps) {
  const coin = StableCoinHelper.mapFromBackend(loanOffer.loan_asset_chain, loanOffer.loan_asset_type)!;
  return (
    <Card>
      <Card.Body>
        <Container className={"p-0 m-0"} fluid>
          <Row>
            <Col sm={2}>
              <Lender {...loanOffer.lender} />
            </Col>
            <Col md={2}>
              <CurrencyFormatter value={loanOffer.loan_amount_min} /> -{" "}
              <CurrencyFormatter value={loanOffer.loan_amount_max} />
            </Col>
            <Col md={1}>{loanOffer.duration_months_min} - {loanOffer.duration_months_max} months</Col>
            <Col md={1}>{loanOffer.min_ltv * 100}%</Col>
            <Col md={1}>{loanOffer.interest_rate * 100}%</Col>
            <Col md={3}>
              <Badge bg="primary">{StableCoinHelper.print(coin)}</Badge>
              {" "}
            </Col>
            <Col md={2} className={"text-end"}>
              <Button variant="primary" onClick={() => onRequest(loanOffer)}>Request Loan</Button>
            </Col>
          </Row>
        </Container>
      </Card.Body>
    </Card>
  );
}
