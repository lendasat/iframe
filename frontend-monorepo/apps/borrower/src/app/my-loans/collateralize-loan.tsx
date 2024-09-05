import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Contract, ContractStatus, useAuth } from "@frontend-monorepo/http-client";
import QRCode from "qrcode.react";
import React, { Suspense } from "react";
import { Alert, Badge, Button, Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { Await, useParams } from "react-router-dom";
import { Lender } from "../request-loan/lender";
import Usd from "../usd";

export function CollateralizeLoan() {
  const { getContract } = useAuth();
  const { id } = useParams();

  return (
    <div>
      <Suspense>
        <Await
          resolve={getContract(id)}
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

  const collateral_sats = contract.collateral_sats;
  const collateral = collateral_sats / 100000000;
  const loanAmount = contract.loan_amount;
  const loanAddress = contract.borrower_loan_address;
  const contractAddress = contract.contract_address;
  const interestRate = contract.interest_rate;

  const initialLtv = contract.initial_ltv;
  const initial_price = loanAmount / (collateral * initialLtv);

  const loanOriginatorFee = (loanAmount / initial_price) * ORIGINATOR_FEE;
  const totalCollateral = collateral + loanOriginatorFee;

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
              <Col className="text-end mb-2">{collateral.toFixed(8)} BTC</Col>
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
                {collateral.toFixed(8)} BTC
              </Col>
            </Row>
            <Row className="justify-content-between mt-2">
              <Col md={6}>Originator Fee 1%</Col>
              <Col md={6} className="text-end">
                {loanOriginatorFee.toFixed(8)} BTC
              </Col>
            </Row>
            <Row className="mt-2 border-top pt-2">
              <Col md={6}>
                <strong>Total collateral to be paid:</strong>
              </Col>
              <Col md={6} className="text-end">
                <strong>
                  {totalCollateral.toFixed(8)} BTC
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
          {(!isCollateralized)
            ? (
              <CollateralContractDetails
                collateral={collateral}
                collateralAddress={contractAddress || ""}
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
}

export function CollateralContractDetails({
  collateral,
  collateralAddress,
}: CollateralContractDetailsProps) {

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
    </Container>
  );
}
