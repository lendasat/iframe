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
        {TransactionInformationList.map((history, index) => (
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

export enum TransactionStatus {
  InProcess = "in process",
  Completed = "completed",
  Failed = "failed",
  Pending = "pending",
}

export enum TransactionType {
  IncomingLoan = "incoming Loan",
  Payment = "payment",
}

interface TransactionInformation {
  transactionType: TransactionType;
  cardUsed: string;
  status: TransactionStatus;
  amount: number;
  date: number;
}

const TransactionInformationList: TransactionInformation[] = [
  {
    transactionType: TransactionType.IncomingLoan,
    cardUsed: "0145",
    status: TransactionStatus.InProcess,
    amount: 3000,
    date: Date.now(),
  },
  {
    transactionType: TransactionType.Payment,
    cardUsed: "0845",
    status: TransactionStatus.Failed,
    amount: 8000,
    date: Date.now(),
  },
  {
    transactionType: TransactionType.Payment,
    cardUsed: "0145",
    status: TransactionStatus.Completed,
    amount: 17000,
    date: Date.now(),
  },
];
