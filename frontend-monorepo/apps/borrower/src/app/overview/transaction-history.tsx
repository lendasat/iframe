import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Badge } from "@frontend/shadcn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@frontend/shadcn";
import { Skeleton } from "@frontend/shadcn";
import {
  LuExternalLink,
  LuClipboard,
  LuCheck,
  LuCreditCard,
  LuTriangleAlert,
  LuShieldAlert,
  LuArrowUp,
  LuArrowDown,
  LuCalendar,
} from "react-icons/lu";
import {
  getTxUrl,
  LoanAsset,
  LoanTransaction,
  TransactionType,
} from "@frontend/ui-shared";
import { format } from "date-fns";
import {
  ContractStatus,
  contractStatusToLabelString,
} from "@frontend/http-client-borrower";

// Helper to format date
const formatDate = (date: Date) => {
  return format(date, "MMM, do yyyy - p");
};

// Helper to shorten txid
const shortenTxid = (txid: string) => {
  if (!txid) return "";
  return `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`;
};

// Helper to get transaction icon and color
const getTransactionInfo = (type: TransactionType) => {
  switch (type) {
    case TransactionType.Funding:
      return {
        icon: <LuArrowDown className="h-5 w-5" />,
        color: "bg-blue-500 text-white",
        label: "Collateral Funding",
      };
    case TransactionType.PrincipalGiven:
      return {
        icon: <LuCreditCard className="h-5 w-5" />,
        color: "bg-green-500 text-white",
        label: "Principal Given",
      };
    case TransactionType.PrincipalRepaid:
      return {
        icon: <LuArrowUp className="h-5 w-5" />,
        color: "bg-purple-500 text-white",
        label: "Principal Repaid",
      };
    case TransactionType.Liquidation:
      return {
        icon: <LuTriangleAlert className="h-5 w-5" />,
        color: "bg-red-500 text-white",
        label: "Collateral Liquidated",
      };
    case TransactionType.ClaimCollateral:
      return {
        icon: <LuArrowUp className="h-5 w-5" />,
        color: "bg-indigo-500 text-white",
        label: "Collateral Claimed",
      };
    case TransactionType.Dispute:
      return {
        icon: <LuShieldAlert className="h-5 w-5" />,
        color: "bg-amber-500 text-white",
        label: "Dispute Filed",
      };
    default:
      return {
        icon: <LuCalendar className="h-5 w-5" />,
        color: "bg-gray-500 text-white",
        label: "Other Transaction",
      };
  }
};

interface TransactionHistoryTimelineProps {
  children: React.ReactNode;
  transactions: LoanTransaction[];
  isLoading?: boolean;
  contractStatus?: ContractStatus;
  assetType?: LoanAsset | undefined;
}

const TransactionHistoryTimeline = ({
  children,
  transactions,
  isLoading = false,
  contractStatus,
  assetType,
}: TransactionHistoryTimelineProps) => {
  const [open, setOpen] = useState(false);
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);

  // Sort transactions by timestamp (oldest first for timeline)
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const handleCopyTxid = (txid: string) => {
    navigator.clipboard.writeText(txid);
    setCopiedTxid(txid);
    setTimeout(() => setCopiedTxid(null), 2000);
  };

  // Group transactions by date (for future expansion if needed)
  const transactionsByDate: Record<string, LoanTransaction[]> = {};
  sortedTransactions.forEach((tx) => {
    const dateKey = new Date(tx.timestamp).toLocaleDateString();
    if (!transactionsByDate[dateKey]) {
      transactionsByDate[dateKey] = [];
    }
    transactionsByDate[dateKey].push(tx);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Transaction History</span>
            <Badge variant="outline" className="ml-2">
              {contractStatus && contractStatusToLabelString(contractStatus)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-grow overflow-auto py-4">
          {isLoading ? (
            // Loading skeleton
            <div className="space-y-6">
              {Array(3)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[150px]" />
                      <Skeleton className="h-4 w-[250px]" />
                    </div>
                  </div>
                ))}
            </div>
          ) : sortedTransactions.length > 0 ? (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

              {/* Timeline items */}
              <div className="space-y-8">
                {sortedTransactions.map((tx, index) => {
                  const { icon, color, label } = getTransactionInfo(
                    tx.transaction_type,
                  );

                  const url = getTxUrl(tx.txid, assetType);

                  return (
                    <div key={tx.txid} className="relative pl-14">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${color}`}
                      >
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="p-4 border rounded-md shadow-sm bg-white">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium">{label}</h3>
                          <Badge variant="outline" className="text-xs">
                            {formatDate(tx.timestamp)}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between align-middle mt-3 space-x-1">
                          <p className="text-xs text-gray-500 font-mono">
                            {shortenTxid(tx.txid)}
                          </p>
                          <div className="flex items-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleCopyTxid(tx.txid)}
                                  >
                                    {copiedTxid === tx.txid ? (
                                      <LuCheck className="h-3 w-3" />
                                    ) : (
                                      <LuClipboard className="h-3 w-3" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copy transaction ID</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      window.open(`${url}`, "_blank")
                                    }
                                  >
                                    <LuExternalLink className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View on blockchain explorer</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-500">
                No transactions found for this contract
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionHistoryTimeline;
