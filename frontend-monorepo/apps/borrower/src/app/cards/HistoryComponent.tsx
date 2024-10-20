import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { GoArrowDownLeft, GoArrowUpRight } from "react-icons/go";
import VisaIcon from "./../../assets/visa_logo_icon.webp";

interface HistoryProps {
  transactionType: string;
  cardUsed: string;
  status: string;
  amount: number;
  date: string;
  time: string;
}

export default function HistoryComponent(history: HistoryProps) {
  return (
    <>
      <Grid className="grid-cols-4 px-4 py-2" align={"center"}>
        <Box>
          <Flex align={"center"} gap={"2"}>
            <Flex align={"center"} justify={"center"} className="w-10 h-10 rounded-full bg-purple-50">
              {history.transactionType == "incoming Loan"
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
            color={history.status == "in process"
              ? "indigo"
              : history.status == "success"
              ? "green"
              : history.status == "failed"
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
            {history.date}
          </Text>
          <Text size={"1"} className="text-font/50" weight={"medium"}>
            {history.time}
          </Text>
        </Box>
      </Grid>
    </>
  );
}
