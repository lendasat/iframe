import { faExclamationCircle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, Text } from "@radix-ui/themes";
import QRCode from "qrcode.react";
import { type FormEvent, useState } from "react";
import { Alert, Col, Container, Form, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

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
        "Contract has been marked as repaid. Once the lender confirms the repayment, you will be\n"
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

  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
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
        <h4>Repayment Details</h4>
      </Row>

      <Row className="mt-4">
        <Col className="text-center">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <Box
              onClick={() => handleCopy(repaymentAddress)}
              p={"5"}
              className="rounded-2xl bg-white cursor-copy hover:shadow-sm"
            >
              <QRCode value={repaymentAddress} size={200} renderAs={"svg"} />
            </Box>
            <div className="d-flex justify-content-center align-items-center">
              <div className="p-4 d-flex align-items-center flex-wrap gap-2">
                <p
                  onClick={() => handleCopy(totalRepaymentAmount.toString())}
                  className="text-break font-semibold cursor-copy m-0"
                >
                  To receive back your collateral please send
                </p>
                <p
                  onClick={() => handleCopy(totalRepaymentAmount.toString())}
                  className="text-break font-semibold cursor-copy m-0"
                >
                  <strong>{formatCurrency(totalRepaymentAmount)}</strong>
                </p>
                <p
                  onClick={() => handleCopy(totalRepaymentAmount.toString())}
                  className="text-break font-semibold cursor-copy m-0"
                >
                  to
                </p>
                <p
                  onClick={() => handleCopy(repaymentAddress)}
                  className="text-break text-font-dark font-semibold cursor-copy m-0"
                >
                  {repaymentAddress}
                </p>
              </div>
            </div>
            <Badge radius="full" color={copied ? "green" : "gray"}>
              <Text size={"1"}>
                {!copied
                  ? "Click address/amount to copy"
                  : "Copied to clipboard!"}
              </Text>
            </Badge>
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
          <Form.Label column={"sm"}>Provide the transaction id</Form.Label>
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
          I've made the payment
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
