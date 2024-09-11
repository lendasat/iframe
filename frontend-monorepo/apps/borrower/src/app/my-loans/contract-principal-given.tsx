import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import QRCode from "qrcode.react";
import React from "react";
import { Alert, Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { formatCurrency } from "../usd";

interface ContractPrincipalGivenProps {
  totalRepaymentAmount: number;
  repaymentAddress: string;
}

export function ContractPrincipalGiven({
  totalRepaymentAmount,
  repaymentAddress,
}: ContractPrincipalGivenProps) {
  return (
    <Container fluid>
      <Row>
        <h4>Repayment Details</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <QRCode value={repaymentAddress} size={200} />
            <p className="mt-2 text-break">
              To receive back your collateral please send <strong>{formatCurrency(totalRepaymentAmount)}</strong> to
              {" "}
              {repaymentAddress}
            </p>
          </div>
        </Col>
      </Row>
      <Row className="mt-2">
        <Col>
          <Alert variant="info">
            <FontAwesomeIcon icon={faInfoCircle} />{" "}
            Once the lender confirms they received the funds, you will be able to withdraw the collateral from the
            contract.
          </Alert>
        </Col>
      </Row>
    </Container>
  );
}
