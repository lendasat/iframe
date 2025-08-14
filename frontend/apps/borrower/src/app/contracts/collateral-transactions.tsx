import React from "react";
import { LuClock, LuExternalLink, LuWifi, LuCheck } from "react-icons/lu";
import { Button, Skeleton } from "@frontend/shadcn";
import {
  GetCollateralTransactionsResponse,
  ContractStatus,
} from "@frontend/http-client-borrower";
import { formatDistanceToNow } from "date-fns";

interface CollateralTransactionsProps {
  data: GetCollateralTransactionsResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const CollateralTransactions: React.FC<CollateralTransactionsProps> = ({
  data,
  loading,
  error,
  lastUpdated,
}) => {
  // Don't render anything if there's no data and no loading state
  if (!data && !loading && !error) {
    return null;
  }

  // Error state
  if (error) {
    return (
      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center">
          <LuWifi className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-600">
            Transaction monitoring unavailable
          </span>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !data) {
    return (
      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-center">
          <Skeleton className="h-4 w-4 rounded mr-2 bg-blue-100" />
          <Skeleton className="h-4 w-32 bg-blue-100" />
        </div>
      </div>
    );
  }

  // No transactions detected yet
  if (
    data &&
    data.confirmed_transactions.length === 0 &&
    data.unconfirmed_transactions.length === 0
  ) {
    return (
      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <LuClock className="h-4 w-4 text-blue-500 mr-2" />
            <span className="text-sm text-blue-700">
              Watching for collateral transactions
            </span>
          </div>
          {lastUpdated && (
            <span className="text-xs text-blue-600">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Has transactions (pending or confirmed)
  if (
    data &&
    (data.unconfirmed_transactions.length > 0 ||
      data.confirmed_transactions.length > 0)
  ) {
    const statusInfo = getStatusInfo(data);
    const hasConfirmed = data.confirmed_transactions.length > 0;
    const hasPending = data.unconfirmed_transactions.length > 0;

    return (
      <div
        className={`mt-3 rounded-md border ${statusInfo.borderColor} ${statusInfo.bgColor} p-3`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {statusInfo.icon}
            <span className={`text-sm font-medium ${statusInfo.textColor}`}>
              {statusInfo.title}
            </span>
          </div>
          {lastUpdated && (
            <span className={`text-xs ${statusInfo.mutedTextColor}`}>
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
        </div>

        <div className="mt-2">
          <span className={`text-sm ${statusInfo.textColor}`}>
            {statusInfo.description}
          </span>
        </div>

        {/* Confirmed Transactions */}
        {hasConfirmed && (
          <div className="mt-3">
            <div className="flex items-center mb-2">
              <LuCheck className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-800">
                Confirmed ({data.confirmed_transactions.length})
              </span>
            </div>
            <div className="space-y-1">
              {data.confirmed_transactions.slice(0, 3).map((txid) => (
                <TransactionRow key={txid} txid={txid} isConfirmed={true} />
              ))}
              {data.confirmed_transactions.length > 3 && (
                <div className="text-xs text-green-600">
                  +{data.confirmed_transactions.length - 3} more confirmed
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending Transactions */}
        {hasPending && (
          <div className={hasConfirmed ? "mt-3" : "mt-2"}>
            <div className="flex items-center mb-2">
              <LuClock className="h-4 w-4 text-amber-600 mr-2" />
              <span className="text-sm font-medium text-amber-800">
                Pending ({data.unconfirmed_transactions.length})
              </span>
            </div>
            <div className="space-y-1">
              {data.unconfirmed_transactions.slice(0, 3).map((txid) => (
                <TransactionRow key={txid} txid={txid} isConfirmed={false} />
              ))}
              {data.unconfirmed_transactions.length > 3 && (
                <div
                  className={`text-xs ${hasConfirmed ? "text-amber-600" : statusInfo.mutedTextColor}`}
                >
                  +{data.unconfirmed_transactions.length - 3} more pending
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

interface TransactionRowProps {
  txid: string;
  isConfirmed: boolean;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  txid,
  isConfirmed,
}) => {
  const textColor = isConfirmed ? "text-green-600" : "text-amber-600";
  const linkColor = isConfirmed ? "text-green-700" : "text-amber-700";

  const url = `${import.meta.env.VITE_MEMPOOL_REST_URL}/tx/${txid}`;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <code className={`text-xs font-mono ${textColor}`}>
          {txid.slice(0, 8)}...{txid.slice(-8)}
        </code>
      </div>
      <Button asChild size={"icon"} variant={"ghost"} className="h-6 w-6">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center ${linkColor}`}
        >
          <LuExternalLink className="h-4 w-4" />{" "}
        </a>
      </Button>
    </div>
  );
};

const getStatusInfo = (data: GetCollateralTransactionsResponse) => {
  switch (data.contract_status) {
    case ContractStatus.Approved:
      if (
        data.confirmed_transactions.length === 0 &&
        data.unconfirmed_transactions.length === 0
      ) {
        return {
          icon: <LuClock className="h-4 w-4 text-violet-500 mr-2" />,
          title: "Watching for collateral transactions",
          description: "Nothing found in mempool yet.",
          bgColor: "bg-violet-50",
          borderColor: "border-violet-200",
          textColor: "text-violet-800",
          mutedTextColor: "text-violet-600",
        };
      } else if (
        data.unconfirmed_transactions.length !== 0 &&
        data.confirmed_transactions.length === 0
      ) {
        return {
          icon: <LuClock className="h-4 w-4 text-violet-500 mr-2" />,
          title: "Collateral found in mempool!",
          description: "Waiting for confirmations.",
          bgColor: "bg-violet-50",
          borderColor: "border-violet-200",
          textColor: "text-violet-800",
          mutedTextColor: "text-violet-600",
        };
      } else {
        return {
          icon: <LuClock className="h-4 w-4 text-violet-500 mr-2" />,
          title: "Collateral transactions found!",
          description: "Waiting for more transactions to confirm.",
          bgColor: "bg-violet-50",
          borderColor: "border-violet-200",
          textColor: "text-violet-800",
          mutedTextColor: "text-violet-600",
        };
      }
    case ContractStatus.CollateralConfirmed:
      return {
        icon: <LuCheck className="h-4 w-4 text-green-500 mr-2" />,
        title: "Collateral confirmed!",
        description: "Refresh the page to view updated contract.",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        textColor: "text-green-800",
        mutedTextColor: "text-green-600",
      };
    default:
      return {
        icon: <LuCheck className="h-4 w-4 text-green-500 mr-2" />,
        title: "Looking for transactions",
        description: "",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        textColor: "text-green-800",
        mutedTextColor: "text-green-600",
      };
  }
};

export default CollateralTransactions;
