import type { Contract, LoanTransaction, TransactionType } from "@frontend-monorepo/http-client-borrower";
import type { Contract, LoanTransaction, TransactionType } from "@frontend-monorepo/http-client-borrower";
import { TransactionType } from "@frontend-monorepo/http-client-borrower";
import { NotificationToast } from "@frontend-monorepo/ui-shared";
import { NotificationToast } from "@frontend-monorepo/ui-shared";
import { Box, Flex } from "@radix-ui/themes";
import type { FC } from "react";
import { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { FaCopy, FaLink } from "react-icons/fa6";

interface TransactionLinkProps {
  transaction: LoanTransaction;
}

function TransactionLink({ transaction }: TransactionLinkProps) {
  // TODO add prefix for loan chain
  let urlPrefix = "";
  const [copied, setCopied] = useState(false);

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
          <a
            href={`${urlPrefix}/tx/${transaction.txid}`}
            target={"_blank"}
            rel={"noreferrer"}
            style={{ marginLeft: "8px" }}
          >
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

interface TransactionListProps {
  contract: Contract;
  transactionType: TransactionType;
}

const TransactionList: FC<TransactionListProps> = ({ contract, transactionType }) => {
  const filteredTransactions = contract.transactions.filter(
    (transaction) => transaction.transaction_type === transactionType,
  );

  return (
    <div>
      <ul>
        {filteredTransactions.length > 0
          ? (
            filteredTransactions.map((transaction) => (
              <li key={transaction.txid} style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <TransactionLink transaction={transaction} />
              </li>
            ))
          )
          : <li>No transaction yet</li>}
      </ul>
    </div>
  );
};

export default TransactionList;
