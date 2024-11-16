import type { CardTransaction } from "@frontend-monorepo/http-client-borrower";
import { CardTransactionStatus } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { GoArrowDownLeft, GoArrowUpRight } from "react-icons/go";
import VisaIcon from "./../../assets/visa_logo_icon.webp";

interface HistoryProps {
  transaction: CardTransaction;
  lastFourCardDigits: string;
}

export default function HistoryComponent({ transaction, lastFourCardDigits }: HistoryProps) {
  const totalFees = transaction.fees.reduce((sum, fee) => sum + fee.amount, 0);

  return (
    <Grid className="grid-cols-4 px-4 py-2" align={"center"}>
      <Box>
        <Flex align={"center"} gap={"2"}>
          <Flex align={"center"} justify={"center"} className="w-10 h-10 rounded-full bg-purple-50">
            {transaction.amount < 0
              ? <GoArrowDownLeft size={"24"} />
              : <GoArrowUpRight size={"24"} />}
          </Flex>
          <Box>
            <Heading size={"2"} weight={"medium"} className="capitalize hidden md:inline-block">
              {transaction.merchant}
            </Heading>
            <Flex align={"center"} gap={"2"}>
              <Text size={"1"}>**** {lastFourCardDigits}</Text>
              <Box className="h-2.5 w-auto">
                <img
                  alt={"Visa card icon"}
                  src={VisaIcon}
                  className="h-full w-full object-contain object-center"
                />
              </Box>
            </Flex>
          </Box>
        </Flex>
      </Box>
      <Box className="flex items-center justify-center capitalize">
        <Badge
          color={transaction.transaction_status === CardTransactionStatus.Authorization
            ? "indigo"
            : transaction.transaction_status === CardTransactionStatus.Pending
            ? "indigo"
            : transaction.transaction_status === CardTransactionStatus.Reversal
            ? "green"
            : transaction.transaction_status === CardTransactionStatus.Refund
            ? "blue"
            : transaction.transaction_status === CardTransactionStatus.Clearing
            ? "green"
            : "gray"}
        >
          {transaction.transaction_status}
        </Badge>
      </Box>

      <Box className="text-center">
        <Text size={"1"} weight={"medium"}>
          <CurrencyFormatter value={transaction.amount} />
        </Text>
        <Text size={"1"} weight={"light"}>
          {" "}(+<CurrencyFormatter value={totalFees} /> Fee)
        </Text>
      </Box>

      <Box className="text-left">
        <Text as="p" weight={"medium"} size={"1"}>
          {formatDateAsDayAndMonth(transaction.date)}
        </Text>
        <Text size={"1"} className="text-font/50" weight={"medium"}>
          {formatDateAsTime(transaction.date)}
        </Text>
      </Box>
    </Grid>
  );
}

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
