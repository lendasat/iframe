import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Contract, ContractStatus, useAuth } from "@frontend-monorepo/http-client";
import QRCode from "qrcode.react";
import React, { Suspense, useState } from "react";
import { Alert, Badge, Button, Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";
import { usePrice } from "../price-context";
import { Lender } from "../request-loan/lender";
import Usd from "../usd";

export function CollateralizeLoan() {
  const { contract } = useAuth();
  const { id } = useParams();

  return (
    <div>
      <Suspense>
        <Await
          resolve={contract(id)}
          errorElement={<div>Could not load contract</div>}
          children={(resolvedContract: Awaited<Contract>) => <CollateralizeLoanComponent contract={resolvedContract} />}
        />
      </Suspense>
    </div>
  );
}

interface CollateralizeLoanComponentProps {
  contract: Contract;
}

function CollateralizeLoanComponent({ contract }: CollateralizeLoanComponentProps) {
  const ORIGINATOR_FEE = 0.01;

  const latestPrice = usePrice().latestPrice;
  const collateral = contract.collateral_sats;
  const loanAmount = contract.loan_amount;
  const loanAddress = contract.loanAddress;
  const collateralAddress = contract.collateralAddress;
  const interestRate = contract.interest_rate;

  const loanOriginatorFee = (loanAmount / latestPrice) * ORIGINATOR_FEE;
  const totalCollateral = collateral + loanOriginatorFee;

  const [isCollateralizedConfirmed, setIsCollateralizedConfirmed] = useState(false);
  const isCollateralized = contract.status === ContractStatus.CollateralConfirmed
    || contract.status === ContractStatus.CollateralSeen;

  return (
    <Container className={"p-4"} fluid>
      <Row className="mt-3">
        <Col xs={12} md={6}>
          <Container fluid>
            <Row>
              <h4>Contract Details</h4>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Lender</Col>
              <Col className="text-end mb-2">
                <Lender {...contract.lender} />
              </Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Contract Status</Col>
              <Col className="text-end mb-2">
                <Badge bg="primary">{contract.status}</Badge>
              </Col>
            </Row>
            <Row className="justify-content-between mt-4">
              <Col md={6}>Loan Amount</Col>
              <Col md={6} className="text-end">
                <Usd value={loanAmount} />
              </Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Collateral</Col>
              <Col className="text-end mb-2">{collateral.toFixed(4)} BTC</Col>
            </Row>
            <Row className="justify-content-between border-b mt-2">
              <Col>Interest rate</Col>
              <Col className="text-end mb-2">
                {interestRate}%
              </Col>
            </Row>

            <Row className="justify-content-between mt-4">
              <Col md={6}>Collateral</Col>
              <Col md={6} className="text-end">
                {collateral.toFixed(4)} BTC
              </Col>
            </Row>
            <Row className="justify-content-between mt-2">
              <Col md={6}>Originator Fee 1%</Col>
              <Col md={6} className="text-end">
                {loanOriginatorFee.toFixed(4)} BTC
              </Col>
            </Row>
            <Row className="mt-2 border-top pt-2">
              <Col md={6}>
                <strong>Total collateral to be paid:</strong>
              </Col>
              <Col md={6} className="text-end">
                <strong>
                  {totalCollateral.toFixed(4)} BTC
                </strong>
              </Col>
            </Row>

            <Row className="justify-content-between mt-4">
              <Alert className="mb-2" key="info" variant="success">
                <FontAwesomeIcon icon={faInfoCircle} /> Your loan principal will be sent to this address.
                <InputGroup className="mt-2">
                  <Form.Control
                    type="text"
                    value={loanAddress}
                    disabled
                    readOnly
                    className="bg-white"
                  />
                </InputGroup>
              </Alert>
            </Row>

            {isCollateralized
              ? (
                <Row className="justify-content-between mt-4">
                  <Row className="mt-1">
                    <Col className="d-grid">
                      <Button
                        variant="primary"
                        onClick={() => {
                          alert("Here goes everything");
                          setIsCollateralizedConfirmed(false);
                        }}
                      >
                        Claim loan principal
                      </Button>
                    </Col>
                  </Row>
                </Row>
              )
              : ""}
          </Container>
        </Col>
        <Col xs={12} md={6}>
          {(!isCollateralizedConfirmed && !isCollateralized)
            ? (
              <CollateralContractDetails
                collateral={collateral}
                collateralAddress={collateralAddress}
                onCollateralize={bool => setIsCollateralizedConfirmed(bool)}
              />
            )
            : ""}
        </Col>
      </Row>
    </Container>
  );
}

interface CollateralContractDetailsProps {
  collateral: number;
  collateralAddress: string;
  onCollateralize: (collateralized: boolean) => void;
}

export function CollateralContractDetails({
  collateral,
  collateralAddress,
  onCollateralize,
}: CollateralContractDetailsProps) {
  const handleConfirmRepayment = () => {
    onCollateralize(true);
  };

  return (
    <Container fluid>
      <Row>
        <h4>Collateral Contract Details</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <QRCode value={collateralAddress} size={200} />
            <p className="mt-2 text-break">
              Please send {collateral} BTC to {collateralAddress}
            </p>
          </div>
        </Col>
      </Row>
      <Row className="mt-1">
        <Col className="d-grid">
          <Button variant="primary" onClick={handleConfirmRepayment}>
            Confirm Collateralization
          </Button>
        </Col>
      </Row>
    </Container>
  );
}
