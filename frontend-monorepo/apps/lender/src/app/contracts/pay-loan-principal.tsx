import { faCopy, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Contract } from "@frontend-monorepo/http-client-lender";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import QRCode from "qrcode.react";
import React, { useState } from "react";
import { Alert, Button, Col, Container, Row, Spinner } from "react-bootstrap";

interface RepaymentDetailsProps {
  contract: Contract;
  onPrincipalGiven: any;
  isLoading: any;
}
const RepaymentDetails = ({ contract, onPrincipalGiven, isLoading }: RepaymentDetailsProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Container fluid>
      <Row>
        <Col>
          <h4>Repayment Details</h4>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <div
              onClick={() => handleCopy(contract.borrower_loan_address)}
              style={{ cursor: "pointer" }}
            >
              <QRCode value={contract.borrower_loan_address} size={200} />
            </div>
            <p className="mt-2 text-break">
              Please send <strong>{formatCurrency(contract.loan_amount)}</strong> to:
            </p>
            <div className="d-flex align-items-center">
              <code>{contract.borrower_loan_address}</code>
              <Button
                variant="link"
                className="ms-2"
                onClick={() => handleCopy(contract.borrower_loan_address)}
              >
                <FontAwesomeIcon icon={faCopy} />
              </Button>
            </div>
            {copied && <small className="text-success">Copied to clipboard!</small>}
          </div>
        </Col>
      </Row>

      <Row className="mt-3">
        <Col>
          <Alert variant="info">
            <FontAwesomeIcon icon={faInfoCircle} className="me-2" />
            Once the borrower receives the funds, the contract is established.
          </Alert>
        </Col>
      </Row>

      <Row className="mt-3">
        <Col>
          <Button onClick={onPrincipalGiven} disabled={isLoading}>
            {isLoading
              ? (
                <Spinner animation="border" role="status" variant="light" size="sm">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              )
              : (
                "Mark principal given"
              )}
          </Button>
        </Col>
      </Row>
    </Container>
  );
};

export default RepaymentDetails;
