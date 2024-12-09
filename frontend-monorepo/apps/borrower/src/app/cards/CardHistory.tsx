import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
import { useAsync } from "react-use";
import HistoryComponent from "./HistoryComponent";

interface CardHistoryProps {
  cardId: number;
  lastFourCardDigits: string;
}

export default function CardHistory({ cardId, lastFourCardDigits }: CardHistoryProps) {
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
      <Grid align={"center"} className="py-1 bg-purple-50 grid-cols-4 px-6 md:px-8 dark:bg-purple-800/20">
        {headers.map((items, index) => (
          <Box key={index} className={` ${items.className}`}>
            <Text size={"1"} weight={"medium"} className="text-font/50 dark:text-font-dark/50">{items.label}</Text>
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
              className="w-full py-1 px-2 rounded-md bg-gray-100 border border-gray-200 dark:bg-dark dark:border-dark"
            >
              <Text size={"1"} weight={"medium"} className="text-font dark:text-font-dark">
                No transactions yet...
              </Text>
            </Flex>
          )}

        {!loading && transactionHistory.map((history, index) => (
          <HistoryComponent
            transaction={history}
            lastFourCardDigits={lastFourCardDigits}
            key={index}
          />
        ))}
      </Box>
    </Box>
  );
}
