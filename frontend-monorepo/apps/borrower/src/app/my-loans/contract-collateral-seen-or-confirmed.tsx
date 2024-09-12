import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Contract, contractStatusToLabelString } from "@frontend-monorepo/http-client";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Alert, Col, Container, Form, InputGroup, Row } from "react-bootstrap";

interface CollateralSeenOrConfirmedProps {
  collateral: string;
  collateralAddress: string;
  contract: Contract;
}

export function CollateralSeenOrConfirmed({
  collateral,
  collateralAddress,
  contract,
}: CollateralSeenOrConfirmedProps) {
  return (
    <Container fluid>
      <Row>
        <h4>{contractStatusToLabelString(contract.status)}</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <p className="mt-2 text-break">
              <strong>{collateral} BTC</strong> are locked in <strong>{collateralAddress}</strong>.
              {/*  TODO: add transaction id*/}
            </p>
          </div>
        </Col>
      </Row>
      <Row className="justify-content-between mt-4">
        <Alert className="mb-2" key="info" variant="success">
          <FontAwesomeIcon icon={faInfoCircle} /> Your loan amount of {formatCurrency(contract.loan_amount)}{" "}
          will be sent to this address.
          <InputGroup className="mt-2">
            <Form.Control
              type="text"
              value={contract.borrower_loan_address}
              disabled
              readOnly
              className="bg-white"
            />
          </InputGroup>
        </Alert>
      </Row>
    </Container>
  );
}
