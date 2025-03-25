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
} from "@frontend/ui-shared";
import QRCode from "qrcode.react";
import { type FormEvent, useState } from "react";
import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
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
              className="text-blue-500 hover:text-blue-700 hover:underline"
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
          className="cursor-copy rounded-2xl bg-white hover:shadow-sm"
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
            className="text-font/60 dark:text-font-dark/60 max-w-sm text-center font-medium"
          >
            Please send <em>exactly</em>
            {"  "}
            <Tooltip
              content={"Copy exact amount to send"}
              className="text-font dark:text-font-dark font-semibold"
            >
              <span
                onClick={() => handleCopy(totalRepaymentAmount.toString())}
                className="text-font dark:text-font-dark cursor-copy font-semibold"
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
              className="mt-1 cursor-copy"
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

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="mb-3">
          <label
            htmlFor="formTxId"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Repayment Transaction ID
          </label>
          <input
            id="formTxId"
            type="text"
            placeholder="e.g. 0x1b3b3d48df236c1e83ab5e7253f885a6f60699963691ad066aa3a5ae3b298d62"
            className="w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            value={txid}
            required
            onChange={(event) => setTxid(event.target.value)}
            disabled={submitted}
          />
        </div>
        <Button type="submit" loading={isLoading} disabled={submitted}>
          Confirm Repayment
        </Button>
      </form>

      {error && (
        <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          <FontAwesomeIcon
            icon={faExclamationCircle}
            className="mr-2 h-4 w-4"
          />
          {error}
        </div>
      )}
    </Flex>
  );
};
