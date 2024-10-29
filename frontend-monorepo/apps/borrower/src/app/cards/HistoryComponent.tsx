import type { CardTransactionType } from "@frontend-monorepo/http-client-borrower";
import { CardTransactionStatus } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { GoArrowDownLeft, GoArrowUpRight } from "react-icons/go";
import VisaIcon from "./../../assets/visa_logo_icon.webp";

interface HistoryProps {
  transactionType: CardTransactionType;
  cardUsed: string;
  status: CardTransactionStatus;
  amount: number;
  date: number;
}

export default function HistoryComponent(history: HistoryProps) {
  return (
    <Grid className="grid-cols-4 px-4 py-2" align={"center"}>
      <Box>
        <Flex align={"center"} gap={"2"}>
          <Flex align={"center"} justify={"center"} className="w-10 h-10 rounded-full bg-purple-50">
            {history.transactionType === "incoming Loan"
              ? <GoArrowDownLeft size={"24"} />
              : <GoArrowUpRight size={"24"} />}
          </Flex>
          <Box>
            <Heading size={"2"} weight={"medium"} className="capitalize hidden md:inline-block">
              {history.transactionType}
            </Heading>
            <Flex align={"center"} gap={"2"}>
              <Text size={"1"}>**** {history.cardUsed}</Text>
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
          color={history.status === CardTransactionStatus.InProcess
            ? "indigo"
            : history.status === CardTransactionStatus.Completed
            ? "green"
            : history.status === CardTransactionStatus.Failed
            ? "red"
            : "gray"}
        >
          {history.status}
        </Badge>
      </Box>

      <Box className="text-center">
        <Text size={"1"} weight={"medium"}>
          <CurrencyFormatter value={history.amount} />
        </Text>
      </Box>

      <Box className="text-left">
        <Text as="p" weight={"medium"} size={"1"}>
          {formatDateAsDayAndMonth(history.date)}
        </Text>
        <Text size={"1"} className="text-font/50" weight={"medium"}>
          {formatDateAsTime(history.date)}
        </Text>
      </Box>
    </Grid>
  );
}

const formatDateAsDayAndMonth = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateAsTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "numeric",
  });
};
