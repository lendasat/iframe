import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import type { CardTransaction as CardTransactionType } from "@frontend/http-client-borrower";
import { CardTransactionStatus } from "@frontend/http-client-borrower";
import { CurrencyFormatter } from "@frontend/ui-shared";
import { Card, CardContent } from "@frontend/shadcn";
import { Badge } from "@frontend/shadcn";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock,
  XCircle
} from "lucide-react";
import { useAsync } from "react-use";
import { format } from "date-fns";

interface CardHistoryProps {
  cardId: string;
  lastFourCardDigits: string;
}

export default function CardHistory({
  cardId,
  lastFourCardDigits,
}: CardHistoryProps) {
  const { getCardTransactions } = useHttpClientBorrower();

  const {
    loading,
    value: maybeTransactionHistory,
    error,
  } = useAsync(async () => {
    return getCardTransactions(cardId);
  }, [cardId]);

  if (error) {
    console.error(`Failed loading transactions ${error}`);
  }

  const transactionHistory = maybeTransactionHistory || [];

  const getTransactionIcon = (transaction: CardTransactionType) => {
    if (transaction.type === "DeclineData") return XCircle;
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      const amount = transaction.data.amount;
      return amount < 0 ? ArrowUpRight : ArrowDownLeft;
    }
    return Clock;
  };

  const getStatusColor = (transaction: CardTransactionType) => {
    if (transaction.type === "DeclineData") {
      return "bg-destructive text-destructive-foreground";
    }
    
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      const status = transaction.data.transaction_status;
      switch (status) {
        case CardTransactionStatus.Authorization:
        case CardTransactionStatus.Clearing:
          return "bg-green-100 text-green-800 border-green-200";
        case CardTransactionStatus.Pending:
          return "bg-yellow-100 text-yellow-800 border-yellow-200";
        case CardTransactionStatus.Reversal:
        case CardTransactionStatus.Refund:
          return "bg-blue-100 text-blue-800 border-blue-200";
        default:
          return "bg-gray-100 text-gray-800 border-gray-200";
      }
    }
    
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getAmountColor = (transaction: CardTransactionType) => {
    if (transaction.type === "DeclineData") return "text-muted-foreground";
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      const amount = transaction.data.amount;
      return amount < 0 ? "text-foreground" : "text-green-600";
    }
    return "text-foreground";
  };

  const getTransactionDescription = (transaction: CardTransactionType) => {
    if (transaction.type === "DeclineData") {
      return transaction.data.merchant;
    }
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      return transaction.data.merchant;
    }
    return "Unknown Transaction";
  };

  const getTransactionDate = (transaction: CardTransactionType) => {
    if (transaction.type === "DeclineData") {
      return new Date(Date.parse(transaction.data.datetime));
    }
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      return new Date(Date.parse(transaction.data.datetime));
    }
    return new Date();
  };

  const getTransactionAmount = (transaction: CardTransactionType) => {
    if (transaction.type === "DeclineData") {
      return transaction.data.amount;
    }
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      return transaction.data.amount;
    }
    return 0;
  };

  const getTransactionStatus = (transaction: CardTransactionType) => {
    if (transaction.type === "DeclineData") {
      return "Declined";
    }
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      return transaction.data.transaction_status;
    }
    return "Unknown";
  };

  const getTotalFees = (transaction: CardTransactionType) => {
    if (transaction.type === "Card" || transaction.type === "CardAuthorizationRefund") {
      return transaction.data.fees.reduce((sum, fee) => sum + fee.amount, 0);
    }
    return 0;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Recent Transactions</h3>
            <Badge variant="secondary" className="text-xs">
              {transactionHistory.length} transactions
            </Badge>
          </div>

          <div className="space-y-3">
            {transactionHistory.map((transaction, index) => {
              const Icon = getTransactionIcon(transaction);
              const amount = getTransactionAmount(transaction);
              const totalFees = getTotalFees(transaction);
              const date = getTransactionDate(transaction);
              
              return (
                <div
                  key={`${transaction.type}-${index}`}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      transaction.type === "DeclineData"
                        ? "bg-destructive/10 text-destructive"
                        : amount < 0 
                          ? "bg-primary/10 text-primary"
                          : "bg-green-100 text-green-600"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="space-y-1">
                      <p className="font-medium">{getTransactionDescription(transaction)}</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-muted-foreground">
                          {format(date, "MMM dd, yyyy • HH:mm")}
                        </p>
                        <span className="text-sm text-muted-foreground">
                          •••• {lastFourCardDigits}
                        </span>
                      </div>
                      {transaction.type === "DeclineData" && (
                        <p className="text-xs text-muted-foreground">
                          Reason: {transaction.data.customer_friendly_description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className={`font-semibold ${getAmountColor(transaction)}`}>
                      {transaction.type === "DeclineData" ? (
                        <CurrencyFormatter value={amount} />
                      ) : (
                        <>
                          {amount < 0 ? "-" : "+"}
                          <CurrencyFormatter value={Math.abs(amount)} />
                        </>
                      )}
                    </div>
                    {totalFees > 0 && (
                      <div className="text-xs text-muted-foreground">
                        +<CurrencyFormatter value={totalFees} /> fee
                      </div>
                    )}
                    <Badge className={`text-xs ${getStatusColor(transaction)}`}>
                      {getTransactionStatus(transaction)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {transactionHistory.length === 0 && (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Your transaction history will appear here</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}