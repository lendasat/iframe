import type { Contract, LoanTransaction } from "@frontend-monorepo/http-client-lender";
import { LoanAssetChain, TransactionType } from "@frontend-monorepo/http-client-lender";
import { NotificationToast } from "@frontend-monorepo/ui-shared";
import { Box, Flex } from "@radix-ui/themes";
import type { FC } from "react";
import { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { FaCopy, FaLink } from "react-icons/fa6";

interface TransactionLinkProps {
  transaction: LoanTransaction;
  loanAssetChain: LoanAssetChain;
}

function TransactionLink({ transaction, loanAssetChain }: TransactionLinkProps) {
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

  if (transactionType === TransactionType.PrincipalGiven || transactionType === TransactionType.PrincipalRepaid) {
    switch (loanAssetChain) {
      case LoanAssetChain.Ethereum:
        urlPrefix = "https://etherscan.io/tx";
        break;
      case LoanAssetChain.Polygon:
        urlPrefix = "https://polygonscan.com/tx";
        break;
      case LoanAssetChain.Starknet:
        urlPrefix = "https://starkscan.co/tx";
        break;
      default:
        urlPrefix = "";
    }
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
            href={`${urlPrefix}/${transaction.txid}`}
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

  const loanAssetChain = contract.loan_asset_chain;

  return (
    <div>
      <ul>
        {filteredTransactions.length > 0
          ? (
            filteredTransactions.map((transaction) => (
              <li key={transaction.txid} style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <TransactionLink transaction={transaction} loanAssetChain={loanAssetChain} />
              </li>
            ))
          )
          : <li>No transaction yet</li>}
      </ul>
    </div>
  );
};

export default TransactionList;
