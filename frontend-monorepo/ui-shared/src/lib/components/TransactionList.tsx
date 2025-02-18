import { Box, Flex } from "@radix-ui/themes";
import type { FC } from "react";
import { useState } from "react";
import { Col, Row } from "react-bootstrap";
import { FaCheckCircle } from "react-icons/fa";
import { FaCopy, FaLink } from "react-icons/fa6";
import { LoanAsset, LoanTransaction } from "../models";
import { TransactionType } from "../models";
import { NotificationToast } from "./NotificationToast";

interface TransactionLinkProps {
  transaction: LoanTransaction;
  loanAsset: LoanAsset;
}

function TransactionLink({ transaction, loanAsset }: TransactionLinkProps) {
  let urlPrefix = "";
  const [copied, setCopied] = useState(false);

  const transactionType = transaction.transaction_type;

  if (
    transactionType === TransactionType.Funding ||
    transactionType === TransactionType.ClaimCollateral ||
    transactionType === TransactionType.Liquidation ||
    transactionType === TransactionType.Dispute
  ) {
    urlPrefix = `${import.meta.env.VITE_MEMPOOL_REST_URL}/tx`;
  }

  if (
    transactionType === TransactionType.PrincipalGiven ||
    transactionType === TransactionType.PrincipalRepaid
  ) {
    switch (loanAsset) {
      case LoanAsset.USDC_ETH:
      case LoanAsset.USDT_ETH:
        urlPrefix = "https://etherscan.io/tx";
        break;
      case LoanAsset.USDT_POL:
      case LoanAsset.USDC_POL:
        urlPrefix = "https://polygonscan.com/tx";
        break;
      case LoanAsset.USDC_SN:
      case LoanAsset.USDT_SN:
        urlPrefix = "https://starkscan.co/tx";
        break;
      case LoanAsset.USDC_SOL:
      case LoanAsset.USDT_SOL:
        urlPrefix = "https://solscan.io/tx";
        break;
      case LoanAsset.USDT_Liquid:
        urlPrefix = "https://liquid.network/tx";
        break;
      case LoanAsset.EUR:
      case LoanAsset.USD:
      case LoanAsset.CHF:
        urlPrefix = "";
        break;
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
      {urlPrefix ? (
        <a
          href={`${urlPrefix}/${transaction.txid}`}
          target={"_blank"}
          rel={"noreferrer"}
          style={{ marginLeft: "8px" }}
        >
          <FaLink className={"text-font dark:text-font-dark"} />
        </a>
      ) : (
        ""
      )}
      <Box onClick={() => handleCopy(transaction.txid)}>
        <NotificationToast
          description={transaction.txid}
          title={"Transaction ID copied"}
        >
          {copied ? (
            <FaCheckCircle className={"text-font dark:text-font-dark"} />
          ) : (
            <FaCopy className={"text-font dark:text-font-dark"} />
          )}
        </NotificationToast>
      </Box>
    </Flex>
  );
}

interface TransactionListProps {
  contract: Contract;
  transactionType: TransactionType;
}

interface Contract {
  loan_asset: LoanAsset;
  transactions: LoanTransaction[];
}

export const TransactionList: FC<TransactionListProps> = ({
  contract,
  transactionType,
}) => {
  const filteredTransactions = contract.transactions.filter(
    (transaction) => transaction.transaction_type === transactionType,
  );

  const loanAsset = contract.loan_asset;

  let transactionName;
  switch (transactionType) {
    case TransactionType.Funding:
      transactionName = "Funding";
      break;
    case TransactionType.PrincipalGiven:
      transactionName = "Principal";
      break;
    case TransactionType.PrincipalRepaid:
      transactionName = "Principal repayment";
      break;
    case TransactionType.ClaimCollateral:
      transactionName = "Collateral claim";
      break;
    case TransactionType.Liquidation:
      transactionName = "Liquidation";
      break;
    case TransactionType.Dispute:
      transactionName = "Dispute";
      break;
  }

  return (
    filteredTransactions.length > 0 && (
      <Row className="justify-content-between border-b dark:border-dark mt-2">
        <Col className={"text-font/70 dark:text-font-dark/70"}>
          {transactionName} transaction
        </Col>
        <Col className="text-end mb-2">
          <div>
            <ul>
              {filteredTransactions.map((transaction: LoanTransaction) => (
                <li
                  key={transaction.txid}
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  <TransactionLink
                    transaction={transaction}
                    loanAsset={loanAsset}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Col>
      </Row>
    )
  );
};
