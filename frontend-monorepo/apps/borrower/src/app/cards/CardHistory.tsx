import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Grid, Spinner, Text } from "@radix-ui/themes";
import React from "react";
import { useAsync } from "react-use";
import HistoryComponent from "./HistoryComponent";

interface CardHistoryProps {
  cardId: number;
}

export default function CardHistory({ cardId }: CardHistoryProps) {
  const { getCardTransactions } = useBorrowerHttpClient();

  const { loading, value: maybeTransactionHistory, error } = useAsync(async () => {
    return getCardTransactions(cardId);
  }, [cardId]);

  if (error) {
    console.error(`Failed loading transactions ${error}`);
  }

  const transactionHistory = maybeTransactionHistory || [];

  const amount_col = {
    label: "Amount",
    className: "text-center",
  };

  const action_col = {
    label: "Action",
    className: "text-left",
  };

  const date_col = {
    label: "Date",
    className: "text-left",
  };
  const status_col = {
    label: "Status",
    className: "text-center",
  };

  const headers = [action_col, status_col, amount_col, date_col];

  return (
    <Box className="flex-1">
      <Grid align={"center"} className="py-1 bg-purple-50 grid-cols-4 px-6 md:px-8">
        {headers.map((items, index) => (
          <Box key={index} className={` ${items.className}`}>
            <Text size={"1"} weight={"medium"} className="text-font/50">{items.label}</Text>
          </Box>
        ))}
      </Grid>
      <Box className="md:overflow-y-scroll h-full">
        {loading
          ? <Spinner />
          : transactionHistory.map((history, index) => (
            <HistoryComponent
              transactionType={history.transactionType}
              cardUsed={history.cardUsed}
              status={history.status}
              amount={history.amount}
              date={history.date}
              key={index}
            />
          ))}
      </Box>
    </Box>
  );
}
