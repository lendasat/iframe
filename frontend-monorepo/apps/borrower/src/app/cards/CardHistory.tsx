import { Box, Grid, Text } from "@radix-ui/themes";
import React from "react";
import HistoryComponent from "./HistoryComponent";

export default function CardHistory() {
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
        {TransactionInformations.map((history, index) => (
          <HistoryComponent
            transactionType={history.transactionType}
            cardUsed={history.cardUsed}
            status={history.status}
            amount={history.amount}
            date={history.date}
            time={history.time}
            key={index}
          />
        ))}
      </Box>
    </Box>
  );
}

const TransactionInformations = [
  {
    transactionType: "incoming Loan",
    cardUsed: "0145",
    status: "in process",
    amount: 3000,
    date: "Tuesday, 15 Oct",
    time: "3:01 PM",
  },
  {
    transactionType: "withdrawal",
    cardUsed: "0845",
    status: "failed",
    amount: 8000,
    date: "Thursday, 17 May",
    time: "8:43 AM",
  },
  {
    transactionType: "withdrawal",
    cardUsed: "0145",
    status: "success",
    amount: 17000,
    date: "Friday, 18 Jan",
    time: "9:31 PM",
  },
];
