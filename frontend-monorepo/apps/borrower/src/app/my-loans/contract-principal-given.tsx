import { faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import { Button } from "@radix-ui/themes";
import QRCode from "qrcode.react";
import { type FormEvent, useState } from "react";
import { Alert, Col, Container, Form, Row } from "react-bootstrap";

interface ContractPrincipalGivenProps {
  totalRepaymentAmount: number;
  repaymentAddress: string;
  contractId: string;
}

export function ContractPrincipalGiven({
  totalRepaymentAmount,
  repaymentAddress,
  contractId,
}: ContractPrincipalGivenProps) {
  const [txid, setTxid] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { markAsRepaymentProvided } = useBorrowerHttpClient();
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");
      setIsLoading(true);
      await markAsRepaymentProvided(contractId, txid);
      setSuccess(
        "Contract has been marked as repaid. Once the lender confirmed the repayment, you will be\n"
          + "able to withdraw the collateral from the contract.",
      );
      setSubmitted(true);
      setTimeout(() => {
        navigate(0);
      }, 1000);
    } catch (error) {
      setError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container fluid>
      <Row>
        <h4>Repayment Details</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <QRCode value={repaymentAddress} size={200} renderAs={"svg"} />
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
          <Alert variant="warning">
            <FontAwesomeIcon icon={faInfoCircle} /> Please send the amount in a single transaction.
          </Alert>
        </Col>
      </Row>

      <Form onSubmit={onSubmit}>
        <Form.Group controlId="formTxId" className="mb-3">
          <Form.Label column={"sm"}>Transaction ID</Form.Label>
          <Form.Control
            type="text"
            placeholder="0x.."
            className="p-3"
            style={{ width: "100%" }}
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            disabled={submitted}
          />
        </Form.Group>
        <Button type="submit" loading={isLoading} disabled={submitted}>
          Submit
        </Button>
      </Form>

      {error && (
        <Alert variant="danger">
          <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="info">
          <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
          {success}
        </Alert>
      )}
    </Container>
  );
}
