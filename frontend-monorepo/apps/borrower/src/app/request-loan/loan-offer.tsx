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

export function LoanOfferComponent(props: LoanOfferProps) {
  const { loanOffer, onRequest } = props;
  const { lender, amount, duration, ltv, interest, coins } = loanOffer;

  return (
    <Card>
      <Card.Body>
        <Container className={"p-0 m-0"} fluid>
          <Row>
            <Col>
              <Lender {...lender} />
            </Col>
            <Col md={2}>
              <CurrencyFormatter value={amount.min} /> - <CurrencyFormatter value={amount.max} />
            </Col>
            <Col md={1}>{duration.min} - {duration.max} months</Col>
            <Col md={1}>{ltv}%</Col>
            <Col md={1}>{interest * 100}%</Col>
            <Col md={3}>
              {coins.map((coin) => (
                <span key={coin}>
                  <Badge bg="primary">{StableCoinHelper.print(coin)}</Badge>
                  {" "}
                </span>
              ))}
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
