import type {
  CardTransaction,
  DeclineData,
  TransactionData,
} from "@frontend/http-client-borrower";
import { CardTransactionStatus } from "@frontend/http-client-borrower";
import { CurrencyFormatter } from "@frontend/ui-shared";
import { Badge, Box, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { AiOutlineStop } from "react-icons/ai";
import { GoArrowDownLeft, GoArrowUpRight } from "react-icons/go";

interface HistoryProps {
  transaction: CardTransaction;
  lastFourCardDigits: string;
}

export default function HistoryComponent({
  transaction,
  lastFourCardDigits,
}: HistoryProps) {
  switch (transaction.type) {
    case "Card":
      return (
        <CardTransaction
          transaction={transaction.data}
          lastFourCardDigits={lastFourCardDigits}
        />
      );
    case "CardAuthorizationRefund":
      return (
        <CardTransaction
          transaction={transaction.data}
          lastFourCardDigits={lastFourCardDigits}
        />
      );
    case "DeclineData":
      return (
        <DeclinedTransaction
          declineData={transaction.data}
          lastFourCardDigits={lastFourCardDigits}
        />
      );
    default:
      return (
        <Text>{`Unknown transaction data ${JSON.stringify(transaction)}`}</Text>
      );
  }
}

interface DeclinedTransactionProps {
  declineData: DeclineData;
  lastFourCardDigits: string;
}

const DeclinedTransaction = ({
  declineData,
  lastFourCardDigits,
}: DeclinedTransactionProps) => {
  const s = declineData.datetime;
  const dateTimestamp = Date.parse(s);
  const date = new Date(dateTimestamp);

  return (
    <Grid className="grid-cols-4 px-4 py-2" align={"center"}>
      <Box>
        <Flex align={"center"} gap={"2"}>
          <Flex
            align={"center"}
            justify={"center"}
            className="w-10 h-10 rounded-full bg-purple-50 dark:bg-dark-600 text-font dark:text-font-dark"
          >
            <AiOutlineStop size={"24"} />
          </Flex>
          <Box>
            <Heading
              size={"2"}
              weight={"medium"}
              className="capitalize hidden md:inline-block text-font dark:text-font-dark"
            >
              {declineData.merchant}
            </Heading>
            <Flex align={"center"} gap={"2"}>
              <Text className={"text-font dark:text-font-dark"} size={"1"}>
                **** {lastFourCardDigits}
              </Text>
            </Flex>
            <Flex align={"center"} gap={"2"}>
              <Text className={"text-font dark:text-font-dark"} size={"1"}>
                {"Reason: "}
                {declineData.customer_friendly_description}
              </Text>
            </Flex>
          </Box>
        </Flex>
      </Box>
      <Box className="flex items-center justify-center capitalize">
        <Badge color={"amber"}>Declined</Badge>
      </Box>

      <Box className="text-center">
        <Text
          className={"text-font dark:text-font-dark"}
          size={"1"}
          weight={"medium"}
        >
          <CurrencyFormatter value={declineData.amount} minFraction={2} />
        </Text>
      </Box>

      <Box className="text-left">
        <Text
          className={"text-font dark:text-font-dark"}
          as="p"
          weight={"medium"}
          size={"1"}
        >
          {formatDateAsDayAndMonth(date)}
        </Text>
        <Text
          size={"1"}
          className="text-font/50 dark:text-font-dark/50"
          weight={"medium"}
        >
          {formatDateAsTime(date)}
        </Text>
      </Box>
    </Grid>
  );
};

interface CardTransactionProps {
  transaction: TransactionData;
  lastFourCardDigits: string;
}

const CardTransaction = ({
  transaction,
  lastFourCardDigits,
}: CardTransactionProps) => {
  const totalFees = transaction.fees.reduce((sum, fee) => sum + fee.amount, 0);

  const s = transaction.datetime;
  const dateTimestamp = Date.parse(s);
  const date = new Date(dateTimestamp);

  return (
    <Grid className="grid-cols-4 px-4 py-2" align={"center"}>
      <Box>
        <Flex align={"center"} gap={"2"}>
          <Flex
            align={"center"}
            justify={"center"}
            className="w-10 h-10 rounded-full bg-purple-50 dark:bg-dark-600 text-font dark:text-font-dark"
          >
            {transaction.amount < 0 ? (
              <GoArrowDownLeft size={"24"} />
            ) : (
              <GoArrowUpRight size={"24"} />
            )}
          </Flex>
          <Box>
            <Heading
              size={"2"}
              weight={"medium"}
              className="capitalize text-font dark:text-font-dark hidden md:inline-block"
            >
              {transaction.merchant}
            </Heading>
            <Flex align={"center"} gap={"2"}>
              <Text className={"text-font dark:text-font-dark"} size={"1"}>
                **** {lastFourCardDigits}
              </Text>
            </Flex>
          </Box>
        </Flex>
      </Box>
      <Box className="flex items-center justify-center capitalize">
        <Badge
          color={
            transaction.transaction_status ===
            CardTransactionStatus.Authorization
              ? "indigo"
              : transaction.transaction_status === CardTransactionStatus.Pending
                ? "indigo"
                : transaction.transaction_status ===
                    CardTransactionStatus.Reversal
                  ? "green"
                  : transaction.transaction_status ===
                      CardTransactionStatus.Refund
                    ? "blue"
                    : transaction.transaction_status ===
                        CardTransactionStatus.Clearing
                      ? "green"
                      : "gray"
          }
        >
          {transaction.transaction_status}
        </Badge>
      </Box>

      <Box className="text-center">
        <Text
          className={"text-font dark:text-font-dark"}
          size={"1"}
          weight={"medium"}
        >
          <CurrencyFormatter
            value={transaction.amount}
            minFraction={2}
            maxFraction={2}
          />
        </Text>
        <Text
          className={"text-font dark:text-font-dark"}
          size={"1"}
          weight={"light"}
        >
          {" "}
          (+
          <CurrencyFormatter
            value={totalFees}
            minFraction={2}
            maxFraction={2}
          />{" "}
          Fee)
        </Text>
      </Box>

      <Box className="text-left">
        <Text
          className={"text-font dark:text-font-dark"}
          as="p"
          weight={"medium"}
          size={"1"}
        >
          {formatDateAsDayAndMonth(date)}
        </Text>
        <Text
          size={"1"}
          className="text-font/50 dark:text-font-dark/50"
          weight={"medium"}
        >
          {formatDateAsTime(date)}
        </Text>
      </Box>
    </Grid>
  );
};

const formatDateAsDayAndMonth = (date: Date): string => {
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateAsTime = (date: Date): string => {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "numeric",
  });
};
