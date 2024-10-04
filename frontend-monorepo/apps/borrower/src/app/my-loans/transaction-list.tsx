import { Contract, TransactionType } from "@frontend-monorepo/http-client-borrower";
import { FaLink } from "react-icons/fa6";

interface TransactionListProps {
  contract: Contract;
  transactionType: TransactionType;
}

const TransactionList: React.FC<TransactionListProps> = ({ contract, transactionType }) => {
  const filteredTransactions = contract.transactions.filter(
    (transaction) => transaction.transaction_type === transactionType,
  );

  // TODO add prefix for loan chain
  let urlPrefix = "";

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

  return (
    <div>
      <ul>
        {filteredTransactions.length > 0
          ? (
            filteredTransactions.map((transaction) => (
              <li key={transaction.id} style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <code>{ellipseId(transaction.id)}</code>
                {urlPrefix
                  ? (
                    <a href={`${urlPrefix}/tx/${transaction.id}`} target={"_blank"} style={{ marginLeft: "8px" }}>
                      <FaLink />
                    </a>
                  )
                  : ""}
              </li>
            ))
          )
          : <li>No transaction yet</li>}
      </ul>
    </div>
  );
};

export default TransactionList;
