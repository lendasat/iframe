import { Box, Button, Callout, Flex } from "@radix-ui/themes";
import { FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { BankingDetailsSummary } from "@frontend/ui-shared";
import { type FormEvent, useState } from "react";
import {
  useHttpClientBorrower,
  FiatLoanDetailsResponse,
} from "@frontend/http-client-borrower";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

interface RepayFiatProps {
  contractId: string;
  fiatLoanDetails?: FiatLoanDetailsResponse;
}

export const RepayFiat = ({ contractId, fiatLoanDetails }: RepayFiatProps) => {
  const navigate = useNavigate();

  const [txid, setTxid] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { markAsRepaymentProvided } = useHttpClientBorrower();
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
            the transfer. This allows the lender to verify the repayment easily.
            Once the lender confirms your repayment, you will be able to claim
            your collateral.
          </Callout.Text>
        </Callout.Root>
      </Box>

      <form onSubmit={onSubmit}>
        <div className="mb-3">
          <label
            className="text-font dark:text-font-dark mb-1 block"
            htmlFor="formTxId"
          >
            Repayment Reference
          </label>
          <input
            type="text"
            id="formTxId"
            placeholder="loan repayment..."
            className="bg-light dark:bg-dark text-font dark:text-font-dark w-full rounded border border-gray-300 p-3 dark:border-gray-600 dark:placeholder-gray-500"
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
        <div className="flex items-center rounded bg-red-100 p-4 text-red-700">
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
