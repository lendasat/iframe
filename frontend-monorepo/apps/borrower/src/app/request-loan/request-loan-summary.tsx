import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Container, Form, Row } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import { formatCurrency } from "../usd";
import { Lender } from "./lender";
import { LoanFilterType } from "./loan-offers-filter";
import { Slider, SliderProps } from "./slider";
import { StableCoin, StableCoinDropdown, StableCoinHelper } from "./stable-coin";

export function RequestLoanSummary() {
  const location = useLocation();
  const { loanOffer, loanFilters } = location.state || {};

  const originatorFee = 0.01;

  // Initialize filters
  const periodFilter = loanFilters.find((filter) => filter.type === LoanFilterType.PERIOD);
  const initMonths = periodFilter
    ? periodFilter.value > loanOffer?.duration.max ? loanOffer?.duration.max || 0 : periodFilter.value
    : loanOffer?.duration.max || 0;

  const amountFilter = loanFilters.find((filter) => filter.type === LoanFilterType.AMOUNT);
  const initAmount = amountFilter ? (amountFilter.value as number) : loanOffer?.amount.min || 0;

  const coinFilter = loanFilters.find((filter) => filter.type === LoanFilterType.STABLECOIN);
  const initCoin = coinFilter
    ? (coinFilter.value as StableCoin)
    : loanOffer.coins.length === 1
    ? loanOffer.coins[0]
    : undefined;

  const [loanAmount, setLoanAmount] = useState<number | undefined>(initAmount);
  const [selectedCoin, setSelectedCoin] = useState<StableCoin | undefined>(initCoin);

  const [address, setAddress] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [loanDuration, setLoanDuration] = useState<number>(initMonths);

  useEffect(() => {
    async function fetchBTCPrice() {
      try {
        const response = await fetch("https://api.coincap.io/v2/assets/bitcoin/");

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const priceUsd = data.data.priceUsd;

        setCollateral(loanAmount / (loanOffer.ltv / 100) / priceUsd);
      } catch (error) {
        console.error("Failed to fetch BTC price:", error);
      }
    }

    fetchBTCPrice();
  }, [loanAmount, loanOffer.ltv]);

  const [collateral, setCollateral] = useState<number>(0);

  const handleLoanAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setLoanAmount(value);

    // Validation
    if (isNaN(value)) {
      setAmountError("Amount is required");
    } else if (value < loanOffer.amount.min || value > loanOffer.amount.max) {
      setAmountError(
        `Amount must be between ${formatCurrency(loanOffer.amount.min)} and ${formatCurrency(loanOffer.amount.max)}`,
      );
    } else {
      setAmountError(null);
    }
  };

  const handleCoinSelect = (coin: StableCoin) => {
    setSelectedCoin(coin);
  };

  const periodSliderProps: SliderProps = {
    min: loanOffer.duration.min,
    max: loanOffer.duration.max,
    step: 1,
    init: loanDuration,
    suffix: " months",
    onChange: (duration) => {
      setLoanDuration(duration);
    },
  };

  const isButtonDisabled = loanAmount === undefined
    || loanAmount < loanOffer.amount.min
    || loanAmount > loanOffer.amount.max
    || amountError != null
    || !selectedCoin
    || !address.trim();

  return (
    <Container className={"p-4"} fluid>
      <Row>
        <h3>
          Collateral Contract <Badge bg="primary">Draft</Badge>
        </h3>
      </Row>
      <Row className="mt-3">
        <Col xs={12} md={6}>
          <Form>
            <Form.Group className="mb-2" controlId="loan-amount">
              <Form.Label>
                <small>Loan Amount</small>
              </Form.Label>
              <Form.Control
                type="number"
                value={loanAmount !== undefined ? loanAmount : ""}
                onChange={handleLoanAmountChange}
                isInvalid={!!amountError}
              />
              {amountError && <Form.Text className="text-danger">{amountError}</Form.Text>}
            </Form.Group>
            <Form.Group className="mb-3" controlId="interest-slider">
              <Form.Label>
                <small>Period</small>
              </Form.Label>
              <Slider {...periodSliderProps} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="stable-coin">
              <Form.Label>
                <small>Stable coin</small>
              </Form.Label>
              <StableCoinDropdown
                coins={loanOffer.coins}
                filter={false}
                defaultCoin={initCoin}
                onSelect={handleCoinSelect}
              />
            </Form.Group>
            <Alert className="mb-2" key="info" variant="info">
              <FontAwesomeIcon icon={faInfoCircle} />{" "}
              Provide a valid address on the target network. Providing an incorrect address here will lead to a loss of
              funds.
            </Alert>
            <Form.Group className="mb-3" controlId="stablecoin-address">
              <Form.Label>
                <small>{StableCoinHelper.print(selectedCoin)} Address</small>
              </Form.Label>
              <Form.Control
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Col>
        <Col xs={12} md={6}>
          <Container fluid>
            <Row className="justify-content-between border-b mt-2">
              <Col>Lender</Col>
              <Col className="text-end mb-2">
                <Lender {...loanOffer.lender} />
              </Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Collateral</Col>
              <Col className="text-end mb-2">{collateral.toFixed(4)} BTC</Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>LTV ratio</Col>
              <Col className="text-end mb-2">{loanOffer.ltv.toFixed(0)}%</Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Interest rate p.a.</Col>
              <Col className="text-end mb-2">{loanOffer.interest}%</Col>
            </Row>
            <Row className="justify-content-between mt-2">
              <Col>Originator fee 1%</Col>
              <Col className="text-end">
                <Container className="p-0" fluid>
                  <Row className="text-end">
                    <Col>{(collateral * originatorFee).toFixed(4)} BTC</Col>
                  </Row>
                  <Row>
                    <Col>
                      <small>~{formatCurrency(loanAmount * originatorFee)}</small>
                    </Col>
                  </Row>
                </Container>
              </Col>
            </Row>
          </Container>
        </Col>
      </Row>
      <Row>
        <Col className={"text-end"}>
          <Link to="/request-loan">
            <Button className={"btn-secondary"}>Cancel</Button>
          </Link>
          <span>{" "}</span>
          <Button disabled={isButtonDisabled}>Request</Button>
        </Col>
      </Row>
    </Container>
  );
}
