import {
  faCopy,
  faExclamationCircle,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Contract } from "@frontend-monorepo/http-client-lender";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import { Heading } from "@radix-ui/themes";
import QRCode from "qrcode.react";
import { useState } from "react";
import { Alert, Button, Col, Container, Row, Spinner } from "react-bootstrap";

interface RepaymentDetailsProps {
  contract: Contract;
  onPrincipalGiven: () => void;
  isLoading: boolean;
  txid: string;
  setTxId: (value: ((prevState: string) => string) | string) => void;
}

const RepaymentDetails = ({
  contract,
  onPrincipalGiven,
  isLoading,
  txid,
  setTxId,
}: RepaymentDetailsProps) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const onConfirm = () => {
    if (txid.length === 0) {
      setError("Transaction id is required");
      return;
    }
    onPrincipalGiven();
  };
  return (
    <Container fluid>
      <Row>
        <Col>
          <Heading className={"text-font dark:text-font-dark"}>
            Payout Details
          </Heading>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <div
              onClick={() => handleCopy(contract.borrower_loan_address)}
              style={{ cursor: "pointer" }}
            >
              <QRCode
                value={contract.borrower_loan_address}
                size={200}
                renderAs={"svg"}
              />
            </div>
            <p className="mt-2 text-break text-font dark:text-font-dark">
              Please send{" "}
              <strong>{formatCurrency(contract.loan_amount)}</strong> (
              {contract.loan_asset_type} on {contract.loan_asset_chain}) to:
            </p>
            <div className="d-flex align-items-center">
              <code>{contract.borrower_loan_address}</code>
              <Button
                variant="link"
                className="ms-2"
                onClick={() => handleCopy(contract.borrower_loan_address)}
              >
                <FontAwesomeIcon
                  icon={faCopy}
                  className={"text-font dark:text-font-dark"}
                />
              </Button>
            </div>
            {copied && (
              <small className="text-success text-font dark:text-font-dark">
                Copied to clipboard!
              </small>
            )}
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
          <label className={"text-font dark:text-font-dark"} htmlFor="txid">
            Transaction ID:
          </label>
          <input
            id="txid"
            type="text"
            value={txid}
            onChange={(e) => setTxId(e.target.value)}
            className={"text-font dark:text-font-dark bg-light dark:bg-dark"}
            placeholder="Enter transaction ID"
          />
        </Col>
      </Row>

      <Row className="mt-3">
        <Col>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <Spinner
                animation="border"
                role="status"
                variant="light"
                size="sm"
              >
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            ) : (
              "Mark principal given"
            )}
          </Button>
        </Col>
      </Row>

      <Row className="mt-3">
        <Col>
          {error && (
            <Alert variant="danger">
              <FontAwesomeIcon
                icon={faExclamationCircle}
                className="h-4 w-4 mr-2"
              />
              {error}
            </Alert>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default RepaymentDetails;
