import { Box, Button, Callout, Flex } from "@radix-ui/themes";
import { FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { BankingDetailsSummary } from "@frontend/ui-shared";
import { type FormEvent, useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FiatLoanDetailsResponse } from "@frontend/base-http-client";

interface RepayFiatProps {
  contractId: string;
  fiatLoanDetails?: FiatLoanDetailsResponse;
}

export const RepayFiat = ({ contractId, fiatLoanDetails }: RepayFiatProps) => {
  const navigate = useNavigate();

  const [txid, setTxid] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { markAsRepaymentProvided } = useBorrowerHttpClient();
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setError("");
      setIsLoading(true);
      await markAsRepaymentProvided(contractId, txid);
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
    <Flex direction={"column"} gap={"3"}>
      <BankingDetailsSummary fiatLoanDetails={fiatLoanDetails} />

      <Box className="text-center">
        <Callout.Root color={"teal"}>
          <Callout.Icon>
            <FaInfoCircle size={"18"} />
          </Callout.Icon>
          <Callout.Text>
            After sending the payment, you <em>must</em> confirm the repayment
            by providing the <strong>reference</strong> you've provided during
            the transfer.This allows the lender to verify the repayment easily.
            Once the lender confirms your repayment, you will be able to claim
            your collateral.
          </Callout.Text>
        </Callout.Root>
      </Box>

      <Form onSubmit={onSubmit}>
        <Form.Group controlId="formTxId" className="mb-3">
          <Form.Label className={"text-font dark:text-font-dark"} column={"sm"}>
            Repayment Reference
          </Form.Label>
          <Form.Control
            type="text"
            placeholder="loan repayment..."
            className="bg-light dark:bg-dark text-font dark:text-font-dark p-3 dark:placeholder-gray-500"
            style={{ width: "100%" }}
            value={txid}
            required={true}
            onChange={(event) => setTxid(event.target.value)}
            disabled={submitted}
          />
        </Form.Group>
        <Button type="submit" loading={isLoading} disabled={submitted}>
          Confirm Repayment
        </Button>
      </Form>

      {error && (
        <Alert variant="danger">
          <FontAwesomeIcon
            icon={faExclamationCircle}
            className="mr-2 h-4 w-4"
          />
          {error}
        </Alert>
      )}
    </Flex>
  );
};
