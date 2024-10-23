import { Contract, LoanTransaction, TransactionType } from "@frontend-monorepo/http-client-lender";
import { NotificationToast } from "@frontend-monorepo/ui-shared";
import { Box, Flex } from "@radix-ui/themes";
import React, { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { FaCopy, FaLink } from "react-icons/fa6";

interface TransactionLinkProps {
  transaction: LoanTransaction;
}

export function TransactionLink({ transaction }: TransactionLinkProps) {
  const [copied, setCopied] = useState(false);
  // TODO add prefix for loan chain
  let urlPrefix = "";

  const transactionType = transaction.transaction_type;

  if (
    transactionType === TransactionType.Funding
    || transactionType === TransactionType.ClaimCollateral
    || transactionType === TransactionType.Liquidation
    || transactionType === TransactionType.Dispute
  ) {
    urlPrefix = import.meta.env.VITE_MEMPOOL_REST_URL;
  }

  const ellipseId = (id: string) => {
    const start = id.slice(0, 6);
    const end = id.slice(-4);
    return `${start}...${end}`;
  };

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
    <Flex justify={"end"}>
      <code>{ellipseId(transaction.txid)}</code>
      {urlPrefix
        ? (
          <a href={`${urlPrefix}/tx/${transaction.txid}`} target={"_blank"} style={{ marginLeft: "8px" }}>
            <FaLink />
          </a>
        )
        : ""}
      <Box
        onClick={() => handleCopy(transaction.txid)}
      >
        <NotificationToast description={transaction.txid} title={"Transaction id copied"}>
          {copied ? <FaCheckCircle /> : <FaCopy />}
        </NotificationToast>
      </Box>
    </Flex>
  );
}

export default TransactionLink;
