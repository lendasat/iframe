import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
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

  const transactionHistoryUnsorted = maybeTransactionHistory || [];
  const transactionHistorySorted = transactionHistoryUnsorted.sort((a, b) => {
    return b.date - a.date;
  });

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

  const noTxHistory = transactionHistorySorted.length === 0;

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
          && <Spinner />}
        {!loading && noTxHistory
          && (
            <Flex
              align={"center"}
              justify={"center"}
              className="w-full py-1 px-2 rounded-md  bg-gray-100 border border-gray-200"
            >
              <Text size={"1"} weight={"medium"} className="text-gray-500">
                No transactions yet...
              </Text>
            </Flex>
          )}

        {!loading && transactionHistorySorted.map((history, index) => (
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
