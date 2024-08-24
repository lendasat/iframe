import { Badge, Button, Card, Col, Container, Row } from "react-bootstrap";
import CurrencyFormatter from "../usd";
import { Lender, LenderProfile } from "./lender";

export enum StableCoin {
  USDT_SN = "USDT_SN",
  USDC_SN = "USDC_SN",
  USDT_ETH = "USDT_ETH",
  USDC_ETH = "USDC_ETH",
}

namespace StableCoin {
  export function print(coin: StableCoin): string {
    switch (coin) {
      case StableCoin.USDT_SN:
        return "USDT Starknet";
      case StableCoin.USDC_SN:
        return "USDC Starknet";
      case StableCoin.USDT_ETH:
        return "USDT Ethereum";
      case StableCoin.USDC_ETH:
        return "USDC Ethereum";
    }
  }
}

export interface LoanDuration {
  min: number;
  max: number;
}

export interface LoanAmount {
  min: number;
  max: number;
}

export interface LoanOffer {
  lender: LenderProfile;
  amount: LoanAmount;
  duration: LoanDuration;
  ltv: number;
  interest: number;
  coins: StableCoin[];
}

export function LoanOfferComponent({ lender, amount, duration, ltv, interest, coins }: LoanOffer) {
  return (
    <>
      <Card>
        <Card.Body>
          <Container className={"p-0 m-0"} fluid>
            <Row>
              <Col>
                <Lender {...lender} />
              </Col>
              <Col md={2}>
                <CurrencyFormatter value={amount.min} currency="USD" locale="en-US" /> -{" "}
                <CurrencyFormatter value={amount.max} currency="USD" locale="en-US" />
              </Col>
              <Col md={1}>{duration.min} - {duration.max} months</Col>
              <Col md={1}>{ltv}%</Col>
              <Col md={1}>{interest}%</Col>
              <Col md={3}>
                {coins.map((coin) => (
                  <span key={coin}>
                    <Badge bg="primary">{StableCoin.print(coin)}</Badge>
                  </span>
                ))}
              </Col>
              <Col md={2} className={"text-end"}>
                <Button variant="primary">Request Loan</Button>
              </Col>
            </Row>
          </Container>
        </Card.Body>
      </Card>
    </>
  );
}
