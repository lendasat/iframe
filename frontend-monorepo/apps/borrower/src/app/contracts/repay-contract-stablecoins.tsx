import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { FaInfoCircle } from "react-icons/fa";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import {
  formatCurrency,
  LoanAsset,
  LoanAssetHelper,
} from "@lendasat/ui-shared";
import QRCode from "qrcode.react";
import { type FormEvent, useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { useBorrowerHttpClient } from "@lendasat/http-client-borrower";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

interface RepayStablecoinsProps {
  expiry: Date;
  loanAsset: LoanAsset;
  repaymentAddress: string;
  contractId: string;
  totalRepaymentAmount: number;
}

export const RepayStablecoins = ({
  expiry,
  loanAsset,
  repaymentAddress,
  contractId,
  totalRepaymentAmount,
}: RepayStablecoinsProps) => {
  const [copied, setCopied] = useState(false);

  const navigate = useNavigate();

  const [txid, setTxid] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { markAsRepaymentProvided } = useBorrowerHttpClient();
  const [submitted, setSubmitted] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

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
      <Box py={"4"} className="text-center">
        <Callout.Root color={"blue"}>
          <Callout.Icon>
            <FaInfoCircle size={"18"} />
          </Callout.Icon>
          <Callout.Text>
            You are expected to pay back your loan by{" "}
            <strong>{format(expiry, "PPPP")}</strong>. Remember to{" "}
            <strong>pay back in full</strong>, with a single transaction;
            partial repayments are not supported. You must pay back using the
            same asset you borrowed:{" "}
            <Link
              to={LoanAssetHelper.toContractUrl(loanAsset)}
              target={"_blank"}
              className="text-blue-500 hover:underline hover:text-blue-700"
            >
              {LoanAssetHelper.print(loanAsset)}
            </Link>
            .
          </Callout.Text>
        </Callout.Root>
      </Box>
      <Box py={"4"} className="text-center">
        <Text
          size={"2"}
          weight={"medium"}
          className="text-font/60 dark:text-font-dark/60"
        >
          Scan QR code to make payment
        </Text>
      </Box>

      <Flex align={"center"} justify={"center"} direction={"column"} gap={"4"}>
        <Box
          onClick={() => handleCopy(repaymentAddress)}
          p={"5"}
          className="rounded-2xl bg-white cursor-copy hover:shadow-sm"
        >
          <QRCode renderAs={"svg"} value={repaymentAddress} size={300} />
        </Box>
        <Flex
          align={"center"}
          justify={"center"}
          direction={"column"}
          gap={"3"}
        >
          <Text
            size={"2"}
            className="text-font/60 dark:text-font-dark/60 text-center max-w-sm font-medium"
          >
            Please send <em>exactly</em>
            {"  "}
            <Tooltip
              content={"Copy exact amount to send"}
              className="text-font dark:text-font-dark font-semibold"
            >
              <span
                onClick={() => handleCopy(totalRepaymentAmount.toString())}
                className="text-font dark:text-font-dark font-semibold cursor-copy"
              >
                {formatCurrency(totalRepaymentAmount)} {"  "}
              </span>
            </Tooltip>
            to{"  "}
            <br />
            <Button
              onClick={() => handleCopy(repaymentAddress)}
              asChild
              variant="ghost"
              className="cursor-copy mt-1"
            >
              <span className="text-font dark:text-font-dark font-semibold">
                {repaymentAddress}
              </span>
            </Button>
          </Text>
          <Badge radius="full" color={copied ? "green" : "gray"}>
            <Text size={"1"}>
              {!copied
                ? "Click address/amount to copy"
                : "Copied to clipboard!"}
            </Text>
          </Badge>
        </Flex>
      </Flex>

      <Box className="text-center">
        <Callout.Root color={"teal"}>
          <Callout.Icon>
            <FaInfoCircle size={"18"} />
          </Callout.Icon>
          <Callout.Text>
            After sending the repayment amount to the address above, you{" "}
            <em>must</em> confirm the repayment by providing the{" "}
            <strong>repayment transaction ID</strong>. Make sure to provide the{" "}
            <strong>correct</strong> transaction ID, to allow the lender to
            verify the repayment. Once the lender confirms your repayment, you
            will be able to claim your collateral.
          </Callout.Text>
        </Callout.Root>
      </Box>

      <Form onSubmit={onSubmit}>
        <Form.Group controlId="formTxId" className="mb-3">
          <Form.Label className={"text-font dark:text-font-dark"} column={"sm"}>
            Repayment Transaction ID
          </Form.Label>
          <Form.Control
            type="text"
            placeholder="e.g. 0x1b3b3d48df236c1e83ab5e7253f885a6f60699963691ad066aa3a5ae3b298d62"
            className="p-3 bg-light dark:bg-dark text-font dark:text-font-dark dark:placeholder-gray-500"
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
            className="h-4 w-4 mr-2"
          />
          {error}
        </Alert>
      )}
    </Flex>
  );
};
