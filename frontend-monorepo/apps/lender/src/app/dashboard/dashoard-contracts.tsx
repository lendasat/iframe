import { Contract, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { Box, Button, Heading } from "@radix-ui/themes";
import React, { Suspense } from "react";
import { Await } from "react-router-dom";
import { AllContracts } from "../contracts/all-contracts";

export default function DashboardContracts() {
  const [table, setTable] = React.useState<number>(0);
  const { getContracts } = useLenderHttpClient();

  return (
    <Box className="space-y-3">
      <Box className="space-y-2 flex items-center justify-between flex-wrap">
        <Heading className="text-black dark:text-white">
          Contracts
        </Heading>
        <Box className="bg-white dark:bg-dark-500 flex items-center gap-1 p-1 rounded-xl border dark:border-dark-600">
          {["All", "Pending", "Expired"].map((tabs, index) => (
            <Button
              size={"3"}
              key={index}
              onClick={() => setTable(index)}
              className={`text-[13px] font-medium ${
                table == index ? "bg-purple-800" : "bg-transparent text-font/60 dark:text-font-dark/60"
              } px-6 max-h-9 rounded-lg`}
            >
              {tabs}
            </Button>
          ))}
        </Box>
      </Box>

      <Suspense>
        <Await
          resolve={getContracts()}
          errorElement={<div className={"text-font dark:text-font-dark"}>Could not load contracts</div>}
          children={(contracts: Awaited<Contract[]>) => (
            <Box className="max-h-96 rounded-xl overflow-auto">
              <AllContracts
                header
                contracts={contracts}
              />
            </Box>
          )}
        />
      </Suspense>
    </Box>
  );
}
