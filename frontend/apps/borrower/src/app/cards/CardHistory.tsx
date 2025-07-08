import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { Box, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
import { useAsync } from "react-use";
import HistoryComponent from "./HistoryComponent";

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

  const amount_col = {
    label: "Amount",
    className: "text-center",
  };

  const action_col = {
    label: "Description",
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

  const noTxHistory = transactionHistory.length === 0;

  return (
    <Box className="flex-1">
      <Grid
        align={"center"}
        className="grid-cols-4 bg-purple-50 px-6 py-1 md:px-8 dark:bg-purple-800/20"
      >
        {headers.map((items) => (
          <Box key={items.label} className={` ${items.className}`}>
            <Text
              size={"1"}
              weight={"medium"}
              className="text-font/50 dark:text-font-dark/50"
            >
              {items.label}
            </Text>
          </Box>
        ))}
      </Grid>
      <Box className="h-full md:overflow-y-scroll">
        {loading && <Spinner />}
        {!loading && noTxHistory && (
          <Flex
            align={"center"}
            justify={"center"}
            className="dark:bg-dark dark:border-dark w-full rounded-md border border-gray-200 bg-gray-100 px-2 py-1"
          >
            <Text
              size={"1"}
              weight={"medium"}
              className="text-font dark:text-font-dark"
            >
              No transactions yet...
            </Text>
          </Flex>
        )}

        {!loading &&
          transactionHistory.map((history) => (
            <HistoryComponent
              transaction={history}
              lastFourCardDigits={lastFourCardDigits}
              key={`${history.data.datetime}-${history.data.merchant}`}
            />
          ))}
      </Box>
    </Box>
  );
}
